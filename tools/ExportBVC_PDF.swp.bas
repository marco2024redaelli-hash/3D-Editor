' ============================================================
' MACRO SOLIDWORKS: Esporta PDF dai Drawing delle BVC nuove
' ============================================================
' Cerca i file SLDDRW corrispondenti ai nuovi GLB aggiunti
' e li salva come PDF nelle cartelle corrette.
'
' Cartella sorgente: C:\PDM_Vault\VB - VIBRATORI CIRCOLARI-LINEARI FINITI\BVC
' Cartelle destinazione:
'   1) public\db\PRD\BVC\  (per il sito web)
'   2) DATABASE1\PRD\BVC\  (per il database locale)
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
Const SRC_ROOT = "C:\PDM_Vault\VB - VIBRATORI CIRCOLARI-LINEARI FINITI\BVC"
Const DST_PUBLIC = "C:\Users\Marco Redaelli\VISUAL STUDIO CODE\3D editor in code\public\db\PRD\BVC"
Const DST_DB1 = "C:\Users\Marco Redaelli\Desktop\DATABASE1\PRD\BVC"

' Mappa: nome GLB (senza estensione) -> sottocartella destinazione
' Solo i file nuovi che mancano di PDF
Dim targetFiles() As String
Dim targetFolders() As String
Dim targetCount As Long

Sub main()
    Set swApp = Application.SldWorks
    Set fso = CreateObject("Scripting.FileSystemObject")

    ' Definisci i file da esportare
    targetCount = 6
    ReDim targetFiles(targetCount - 1)
    ReDim targetFolders(targetCount - 1)

    targetFiles(0) = "BVC-331-DX-A000": targetFolders(0) = "TIPO_3"
    targetFiles(1) = "BVC-361-SX-A000": targetFolders(1) = "TIPO_3"
    targetFiles(2) = "BVC-431-DX-A000": targetFolders(2) = "TIPO_4a"
    targetFiles(3) = "BVC-462-SX-A000": targetFolders(3) = "TIPO_4a"
    targetFiles(4) = "BVC-531-DX-A000": targetFolders(4) = "TIPO_5a"
    targetFiles(5) = "BVC-531-SX-A000": targetFolders(5) = "TIPO_5a"

    Dim logMsg As String
    logMsg = "=== EXPORT BVC SLDDRW -> PDF ===" & vbCrLf
    logMsg = logMsg & "Sorgente: " & SRC_ROOT & vbCrLf
    logMsg = logMsg & "Destinazione 1: " & DST_PUBLIC & vbCrLf
    logMsg = logMsg & "Destinazione 2: " & DST_DB1 & vbCrLf & vbCrLf

    ' Cerca tutti i SLDDRW nella sorgente
    Dim drwFiles() As String
    Dim drwPaths() As String
    Dim drwCount As Long
    drwCount = 0
    CollectSLDDRW SRC_ROOT, drwFiles, drwPaths, drwCount

    logMsg = logMsg & "Drawing trovati nel vault: " & drwCount & vbCrLf & vbCrLf

    Dim successCount As Long
    Dim failCount As Long
    Dim skipCount As Long
    successCount = 0
    failCount = 0
    skipCount = 0

    Dim i As Long
    For i = 0 To targetCount - 1
        Dim baseName As String
        baseName = targetFiles(i)
        Dim dstFolder As String
        dstFolder = targetFolders(i)

        logMsg = logMsg & "[" & (i + 1) & "/" & targetCount & "] " & baseName & vbCrLf

        ' Cerca il SLDDRW corrispondente
        Dim srcPath As String
        srcPath = FindDrawing(baseName, drwFiles, drwPaths, drwCount)

        If srcPath = "" Then
            logMsg = logMsg & "  SLDDRW NON TROVATO - provo ricerca case-insensitive..." & vbCrLf
            srcPath = FindDrawingFuzzy(baseName, drwFiles, drwPaths, drwCount)
        End If

        If srcPath = "" Then
            logMsg = logMsg & "  ERRORE: Drawing non trovato nel vault" & vbCrLf
            failCount = failCount + 1
            GoTo NextTarget
        End If

        logMsg = logMsg & "  Sorgente: " & srcPath & vbCrLf

        ' Percorsi PDF destinazione
        Dim pdfName As String
        pdfName = baseName & ".pdf"

        Dim dstPublic As String
        Dim dstDB1 As String
        dstPublic = DST_PUBLIC & "\" & dstFolder & "\" & pdfName
        dstDB1 = DST_DB1 & "\" & dstFolder & "\" & pdfName

        EnsureFolder DST_PUBLIC & "\" & dstFolder
        EnsureFolder DST_DB1 & "\" & dstFolder

        ' Apri il drawing
        Dim swDoc As SldWorks.ModelDoc2
        Dim errors As Long
        Dim warnings As Long

        Set swDoc = swApp.OpenDoc6(srcPath, swDocDRAWING, _
            swOpenDocOptions_Silent Or swOpenDocOptions_ReadOnly, _
            "", errors, warnings)

        If swDoc Is Nothing Then
            logMsg = logMsg & "  ERRORE: apertura fallita (err=" & errors & ")" & vbCrLf
            failCount = failCount + 1
            GoTo NextTarget
        End If

        ' Esporta PDF nella cartella public
        Dim result1 As Boolean
        result1 = ExportToPDF(swDoc, dstPublic)
        If result1 Then
            logMsg = logMsg & "  -> public: OK (" & GetFileSizeKB(dstPublic) & " KB)" & vbCrLf
        Else
            logMsg = logMsg & "  -> public: FALLITO" & vbCrLf
        End If

        ' Esporta PDF nella cartella DATABASE1
        Dim result2 As Boolean
        result2 = ExportToPDF(swDoc, dstDB1)
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

NextTarget:
    Next i

    ' Report finale
    logMsg = logMsg & vbCrLf & "================================" & vbCrLf
    logMsg = logMsg & "COMPLETATO" & vbCrLf
    logMsg = logMsg & "  Esportati: " & successCount & vbCrLf
    logMsg = logMsg & "  Errori:    " & failCount & vbCrLf

    ' Salva log
    Dim logPath As String
    logPath = "C:\Users\Marco Redaelli\VISUAL STUDIO CODE\3D editor in code\tools\export_bvc_pdf_log.txt"
    Dim f As Integer
    f = FreeFile
    Open logPath For Output As #f
    Print #f, logMsg
    Close #f

    MsgBox logMsg, vbInformation, "Export BVC PDF completato"

End Sub

' --- Esporta un drawing come PDF ---
Function ExportToPDF(swDoc As SldWorks.ModelDoc2, outputPath As String) As Boolean
    Dim errors As Long
    Dim warnings As Long

    ' Configura opzioni PDF
    Dim swExportData As SldWorks.ExportPdfData
    Set swExportData = swApp.GetExportFileData(swExportPdfData)

    If Not swExportData Is Nothing Then
        swExportData.ViewPdfAfterSaving = False
    End If

    ' Metodo 1: Extension.SaveAs
    Dim result As Boolean
    result = swDoc.Extension.SaveAs(outputPath, 0, swSaveAsOptions_Silent, swExportData, errors, warnings)

    If result And fso.FileExists(outputPath) Then
        ExportToPDF = True
        Exit Function
    End If

    ' Metodo 2: SaveAs3 (fallback)
    Dim result2 As Long
    result2 = swDoc.SaveAs3(outputPath, 0, swSaveAsOptions_Silent)

    If fso.FileExists(outputPath) Then
        ExportToPDF = True
        Exit Function
    End If

    ExportToPDF = False
End Function

' --- Cerca drawing per nome esatto ---
Function FindDrawing(baseName As String, ByRef names() As String, ByRef paths() As String, count As Long) As String
    Dim i As Long
    For i = 0 To count - 1
        If UCase(names(i)) = UCase(baseName) Then
            FindDrawing = paths(i)
            Exit Function
        End If
    Next
    FindDrawing = ""
End Function

' --- Cerca drawing con match parziale ---
Function FindDrawingFuzzy(baseName As String, ByRef names() As String, ByRef paths() As String, count As Long) As String
    Dim searchName As String
    searchName = UCase(baseName)

    Dim i As Long
    For i = 0 To count - 1
        If InStr(UCase(names(i)), searchName) > 0 Then
            FindDrawingFuzzy = paths(i)
            Exit Function
        End If
    Next

    ' Prova anche senza il suffisso A000
    Dim shortName As String
    shortName = Replace(searchName, "-A000", "")
    For i = 0 To count - 1
        If InStr(UCase(names(i)), shortName) > 0 Then
            FindDrawingFuzzy = paths(i)
            Exit Function
        End If
    Next

    FindDrawingFuzzy = ""
End Function

' --- Raccolta ricorsiva file SLDDRW ---
Sub CollectSLDDRW(folderPath As String, ByRef names() As String, ByRef paths() As String, ByRef count As Long)
    Dim folder As Object
    Dim file As Object
    Dim subFolder As Object

    If Not fso.FolderExists(folderPath) Then Exit Sub

    Set folder = fso.GetFolder(folderPath)

    For Each file In folder.files
        If UCase(fso.GetExtensionName(file.Name)) = "SLDDRW" Then
            If InStr(LCase(folderPath), "obsolet") = 0 Then
                If count = 0 Then
                    ReDim names(0)
                    ReDim paths(0)
                Else
                    ReDim Preserve names(count)
                    ReDim Preserve paths(count)
                End If
                names(count) = fso.GetBaseName(file.Name)
                paths(count) = file.Path
                count = count + 1
            End If
        End If
    Next

    For Each subFolder In folder.SubFolders
        Dim subName As String
        subName = LCase(subFolder.Name)
        If InStr(subName, "obsolet") = 0 Then
            CollectSLDDRW subFolder.Path, names, paths, count
        End If
    Next
End Sub

' --- Utility: crea cartella se non esiste ---
Sub EnsureFolder(path As String)
    If Not fso.FolderExists(path) Then
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
