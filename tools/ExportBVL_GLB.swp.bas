' ============================================================
' MACRO SOLIDWORKS: Esporta tutti i SLDASM in GLB
' ============================================================
' Cartella sorgente: C:\PDM_Vault\VB - VIBRATORI CIRCOLARI-LINEARI FINITI\BVL
' Cartelle destinazione:
'   1) public\db\PRD\BVL\  (per il sito web)
'   2) DATABASE1\PRD\BVL\  (per il database locale)
'
' Istruzioni:
'   1. Apri SolidWorks
'   2. Strumenti > Macro > Nuova
'   3. Copia questo codice nel modulo
'   4. Esegui (F5)
' ============================================================

Dim swApp As SldWorks.SldWorks
Dim fso As Object

' --- CONFIGURAZIONE ---
Const SRC_ROOT = "C:\PDM_Vault\VB - VIBRATORI CIRCOLARI-LINEARI FINITI\BVL"
Const DST_PUBLIC = "C:\Users\Marco Redaelli\VISUAL STUDIO CODE\3D editor in code\public\db\PRD\BVL"
Const DST_DB1 = "C:\Users\Marco Redaelli\Desktop\DATABASE1\PRD\BVL"

Sub main()
    Set swApp = Application.SldWorks
    Set fso = CreateObject("Scripting.FileSystemObject")

    Dim logMsg As String
    logMsg = "=== EXPORT BVL SLDASM -> GLB ===" & vbCrLf
    logMsg = logMsg & "Sorgente: " & SRC_ROOT & vbCrLf
    logMsg = logMsg & "Destinazione 1: " & DST_PUBLIC & vbCrLf
    logMsg = logMsg & "Destinazione 2: " & DST_DB1 & vbCrLf & vbCrLf

    ' Assicura che le cartelle destinazione esistano
    EnsureFolder DST_PUBLIC
    EnsureFolder DST_DB1

    Dim successCount As Long
    Dim failCount As Long
    successCount = 0
    failCount = 0

    ' Scansiona ricorsivamente la cartella sorgente
    Dim files() As String
    Dim fileCount As Long
    fileCount = 0

    CollectSLDASM SRC_ROOT, files, fileCount

    If fileCount = 0 Then
        MsgBox "Nessun file SLDASM trovato in " & SRC_ROOT, vbExclamation
        Exit Sub
    End If

    logMsg = logMsg & "File SLDASM trovati: " & fileCount & vbCrLf & vbCrLf

    Dim i As Long
    For i = 0 To fileCount - 1
        Dim srcPath As String
        srcPath = files(i)

        ' Estrai nome e sottocartella relativa
        Dim relPath As String
        relPath = Mid(srcPath, Len(SRC_ROOT) + 2) ' rimuovi il prefisso + backslash

        Dim fileName As String
        fileName = fso.GetFileName(srcPath)

        ' Determina la sottocartella (es. VL101, VL201, etc.)
        Dim subFolder As String
        subFolder = Split(relPath, "\")(0)

        ' Nome GLB: tutto minuscolo, estensione .glb
        Dim glbName As String
        glbName = LCase(Replace(fso.GetBaseName(fileName), " ", "-")) & ".glb"

        ' Percorsi destinazione
        Dim dstPublic As String
        Dim dstDB1 As String
        dstPublic = DST_PUBLIC & "\" & subFolder & "\" & glbName
        dstDB1 = DST_DB1 & "\" & subFolder & "\" & glbName

        EnsureFolder DST_PUBLIC & "\" & subFolder
        EnsureFolder DST_DB1 & "\" & subFolder

        logMsg = logMsg & "[" & (i + 1) & "/" & fileCount & "] " & fileName & vbCrLf

        ' Apri il file
        Dim swDoc As SldWorks.ModelDoc2
        Dim errors As Long
        Dim warnings As Long

        Set swDoc = swApp.OpenDoc6(srcPath, swDocASSEMBLY, _
            swOpenDocOptions_Silent Or swOpenDocOptions_ReadOnly, _
            "", errors, warnings)

        If swDoc Is Nothing Then
            logMsg = logMsg & "  ERRORE: apertura fallita (err=" & errors & ")" & vbCrLf
            failCount = failCount + 1
            GoTo NextFile
        End If

        ' Esporta GLB nella cartella public
        Dim result1 As Boolean
        result1 = ExportToGLB(swDoc, dstPublic)

        If result1 Then
            logMsg = logMsg & "  -> public: OK (" & GetFileSizeKB(dstPublic) & " KB)" & vbCrLf
        Else
            logMsg = logMsg & "  -> public: FALLITO" & vbCrLf
        End If

        ' Esporta GLB nella cartella DATABASE1
        Dim result2 As Boolean
        result2 = ExportToGLB(swDoc, dstDB1)

        If result2 Then
            logMsg = logMsg & "  -> DB1:    OK (" & GetFileSizeKB(dstDB1) & " KB)" & vbCrLf
        Else
            logMsg = logMsg & "  -> DB1:    FALLITO" & vbCrLf
        End If

        If result1 Or result2 Then
            successCount = successCount + 1
        Else
            failCount = failCount + 1
        End If

        ' Chiudi documento
        swApp.CloseDoc swDoc.GetPathName
        Set swDoc = Nothing

NextFile:
    Next i

    ' Report finale
    logMsg = logMsg & vbCrLf & "================================" & vbCrLf
    logMsg = logMsg & "COMPLETATO" & vbCrLf
    logMsg = logMsg & "  Convertiti: " & successCount & vbCrLf
    logMsg = logMsg & "  Errori:     " & failCount & vbCrLf

    ' Salva log
    Dim logPath As String
    logPath = "C:\Users\Marco Redaelli\VISUAL STUDIO CODE\3D editor in code\tools\export_bvl_log.txt"
    Dim f As Integer
    f = FreeFile
    Open logPath For Output As #f
    Print #f, logMsg
    Close #f

    MsgBox logMsg, vbInformation, "Export BVL completato"

End Sub

' --- Esporta un documento come GLB ---
Function ExportToGLB(swDoc As SldWorks.ModelDoc2, outputPath As String) As Boolean
    Dim errors As Long
    Dim warnings As Long

    ' Metodo 1: Extension.SaveAs (preferito per SW 2024+)
    Dim result As Boolean
    result = swDoc.Extension.SaveAs(outputPath, 0, swSaveAsOptions_Silent, Nothing, errors, warnings)

    If result And fso.FileExists(outputPath) Then
        ExportToGLB = True
        Exit Function
    End If

    ' Metodo 2: SaveAs3
    Dim result2 As Long
    result2 = swDoc.SaveAs3(outputPath, 0, swSaveAsOptions_Silent)

    If fso.FileExists(outputPath) Then
        ExportToGLB = True
        Exit Function
    End If

    ' Metodo 3: Prova con Extension.SaveAs2 (SW 2024 SP3+)
    On Error Resume Next
    result = swDoc.Extension.SaveAs2(outputPath, 0, swSaveAsOptions_Silent, Nothing, "", False, errors, warnings)
    On Error GoTo 0

    If fso.FileExists(outputPath) Then
        ExportToGLB = True
        Exit Function
    End If

    ExportToGLB = False
End Function

' --- Raccolta ricorsiva file SLDASM ---
Sub CollectSLDASM(folderPath As String, ByRef files() As String, ByRef count As Long)
    Dim folder As Object
    Dim file As Object
    Dim subFolder As Object

    If Not fso.FolderExists(folderPath) Then Exit Sub

    Set folder = fso.GetFolder(folderPath)

    ' File nella cartella corrente
    For Each file In folder.files
        If UCase(fso.GetExtensionName(file.Name)) = "SLDASM" Then
            ' Ignora cartelle obsolete
            If InStr(LCase(folderPath), "obsolet") = 0 And _
               InStr(LCase(folderPath), "costruttivo") = 0 And _
               InStr(LCase(folderPath), "fornitore") = 0 And _
               InStr(LCase(folderPath), "osca") = 0 And _
               InStr(LCase(folderPath), "personalizzat") = 0 Then

                If count = 0 Then
                    ReDim files(0)
                Else
                    ReDim Preserve files(count)
                End If
                files(count) = file.Path
                count = count + 1
            End If
        End If
    Next

    ' Sottocartelle (ricorsivo) - ma solo le cartelle VL*
    For Each subFolder In folder.SubFolders
        Dim subName As String
        subName = LCase(subFolder.Name)
        ' Includi solo cartelle VL* e le principali, escludi costruttivo/fornitore/etc
        If Left(subName, 2) = "vl" Or _
           subName = "basi lineari" Or _
           subName = "coperchi lineari" Or _
           subName = "elementi per basi" Then
            CollectSLDASM subFolder.Path, files, count
        End If
    Next
End Sub

' --- Utility: crea cartella se non esiste ---
Sub EnsureFolder(path As String)
    If Not fso.FolderExists(path) Then
        ' Crea ricorsivamente
        Dim parent As String
        parent = fso.GetParentFolderName(path)
        If Not fso.FolderExists(parent) Then
            EnsureFolder parent
        End If
        fso.CreateFolder path
    End If
End Sub

' --- Utility: dimensione file in KB ---
Function GetFileSizeKB(path As String) As Long
    On Error Resume Next
    If fso.FileExists(path) Then
        GetFileSizeKB = CLng(fso.GetFile(path).Size / 1024)
    Else
        GetFileSizeKB = 0
    End If
    On Error GoTo 0
End Function
