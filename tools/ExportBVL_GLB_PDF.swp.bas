' ============================================================
' MACRO SOLIDWORKS: Esporta tutti i BVL in GLB + PDF
' ============================================================
' Cartella sorgente: C:\PDM_Vault\VB - VIBRATORI CIRCOLARI-LINEARI FINITI\BVL
' Cartelle destinazione:
'   1) public\db\PRD\BVL\{VLxxx}\  (per il sito web)
'   2) DATABASE1\PRD\BVL\{VLxxx}\  (per il database locale)
'
' La macro:
'   - Scansiona ricorsivamente la sorgente
'   - Per ogni SLDASM trovato -> esporta GLB
'   - Per ogni SLDDRW trovato -> esporta PDF
'   - Salva in entrambe le destinazioni
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
    logMsg = "=== EXPORT BVL -> GLB + PDF ===" & vbCrLf
    logMsg = logMsg & "Sorgente: " & SRC_ROOT & vbCrLf
    logMsg = logMsg & "Destinazione 1: " & DST_PUBLIC & vbCrLf
    logMsg = logMsg & "Destinazione 2: " & DST_DB1 & vbCrLf & vbCrLf

    EnsureFolder DST_PUBLIC
    EnsureFolder DST_DB1

    ' --- Fase 1: Raccogli tutti i file ---
    Dim asmFiles() As String
    Dim asmPaths() As String
    Dim asmCount As Long
    asmCount = 0
    CollectFiles SRC_ROOT, "SLDASM", asmFiles, asmPaths, asmCount

    Dim drwFiles() As String
    Dim drwPaths() As String
    Dim drwCount As Long
    drwCount = 0
    CollectFiles SRC_ROOT, "SLDDRW", drwFiles, drwPaths, drwCount

    logMsg = logMsg & "SLDASM trovati: " & asmCount & vbCrLf
    logMsg = logMsg & "SLDDRW trovati: " & drwCount & vbCrLf & vbCrLf

    If asmCount = 0 And drwCount = 0 Then
        MsgBox "Nessun file trovato in " & SRC_ROOT, vbExclamation
        Exit Sub
    End If

    Dim glbOK As Long, glbFail As Long
    Dim pdfOK As Long, pdfFail As Long
    glbOK = 0: glbFail = 0
    pdfOK = 0: pdfFail = 0

    ' --- Fase 2: Esporta GLB da SLDASM ---
    logMsg = logMsg & "=== ESPORTAZIONE GLB ===" & vbCrLf
    Dim i As Long
    For i = 0 To asmCount - 1
        Dim asmSrc As String
        asmSrc = asmPaths(i)

        ' Determina sottocartella (es. VL101, VL201, etc.)
        Dim relPath As String
        relPath = Mid(asmSrc, Len(SRC_ROOT) + 2)
        Dim subFolder As String
        subFolder = Split(relPath, "\")(0)

        ' Nome GLB: minuscolo
        Dim glbName As String
        glbName = LCase(Replace(fso.GetBaseName(asmSrc), " ", "-")) & ".glb"

        Dim dstPub As String
        Dim dstDb As String
        dstPub = DST_PUBLIC & "\" & subFolder & "\" & glbName
        dstDb = DST_DB1 & "\" & subFolder & "\" & glbName

        EnsureFolder DST_PUBLIC & "\" & subFolder
        EnsureFolder DST_DB1 & "\" & subFolder

        logMsg = logMsg & "[GLB " & (i + 1) & "/" & asmCount & "] " & fso.GetFileName(asmSrc) & vbCrLf

        ' Apri assembly
        Dim swDoc As SldWorks.ModelDoc2
        Dim errors As Long
        Dim warnings As Long

        Set swDoc = swApp.OpenDoc6(asmSrc, swDocASSEMBLY, _
            swOpenDocOptions_Silent Or swOpenDocOptions_ReadOnly, _
            "", errors, warnings)

        If swDoc Is Nothing Then
            logMsg = logMsg & "  ERRORE apertura (err=" & errors & ")" & vbCrLf
            glbFail = glbFail + 1
            GoTo NextAsm
        End If

        ' Esporta GLB
        Dim r1 As Boolean
        r1 = ExportGLB(swDoc, dstPub)
        If r1 Then
            logMsg = logMsg & "  -> public: OK (" & GetFileSizeKB(dstPub) & " KB)" & vbCrLf
        Else
            logMsg = logMsg & "  -> public: FALLITO" & vbCrLf
        End If

        Dim r2 As Boolean
        r2 = ExportGLB(swDoc, dstDb)
        If r2 Then
            logMsg = logMsg & "  -> DB1:    OK (" & GetFileSizeKB(dstDb) & " KB)" & vbCrLf
        Else
            logMsg = logMsg & "  -> DB1:    FALLITO" & vbCrLf
        End If

        If r1 Or r2 Then
            glbOK = glbOK + 1
        Else
            glbFail = glbFail + 1
        End If

        swApp.CloseDoc swDoc.GetPathName
        Set swDoc = Nothing

NextAsm:
    Next i

    ' --- Fase 3: Esporta PDF da SLDDRW ---
    logMsg = logMsg & vbCrLf & "=== ESPORTAZIONE PDF ===" & vbCrLf
    Dim j As Long
    For j = 0 To drwCount - 1
        Dim drwSrc As String
        drwSrc = drwPaths(j)

        Dim relPath2 As String
        relPath2 = Mid(drwSrc, Len(SRC_ROOT) + 2)
        Dim subFolder2 As String
        subFolder2 = Split(relPath2, "\")(0)

        ' Nome PDF: MAIUSCOLO (come da convenzione)
        Dim pdfName As String
        pdfName = UCase(fso.GetBaseName(drwSrc)) & ".pdf"

        Dim dstPub2 As String
        Dim dstDb2 As String
        dstPub2 = DST_PUBLIC & "\" & subFolder2 & "\" & pdfName
        dstDb2 = DST_DB1 & "\" & subFolder2 & "\" & pdfName

        EnsureFolder DST_PUBLIC & "\" & subFolder2
        EnsureFolder DST_DB1 & "\" & subFolder2

        logMsg = logMsg & "[PDF " & (j + 1) & "/" & drwCount & "] " & fso.GetFileName(drwSrc) & vbCrLf

        ' Apri drawing
        Dim swDoc2 As SldWorks.ModelDoc2
        Dim errors2 As Long
        Dim warnings2 As Long

        Set swDoc2 = swApp.OpenDoc6(drwSrc, swDocDRAWING, _
            swOpenDocOptions_Silent Or swOpenDocOptions_ReadOnly, _
            "", errors2, warnings2)

        If swDoc2 Is Nothing Then
            logMsg = logMsg & "  ERRORE apertura (err=" & errors2 & ")" & vbCrLf
            pdfFail = pdfFail + 1
            GoTo NextDrw
        End If

        ' Esporta PDF
        Dim p1 As Boolean
        p1 = ExportPDF(swDoc2, dstPub2)
        If p1 Then
            logMsg = logMsg & "  -> public: OK (" & GetFileSizeKB(dstPub2) & " KB)" & vbCrLf
        Else
            logMsg = logMsg & "  -> public: FALLITO" & vbCrLf
        End If

        Dim p2 As Boolean
        p2 = ExportPDF(swDoc2, dstDb2)
        If p2 Then
            logMsg = logMsg & "  -> DB1:    OK (" & GetFileSizeKB(dstDb2) & " KB)" & vbCrLf
        Else
            logMsg = logMsg & "  -> DB1:    FALLITO" & vbCrLf
        End If

        If p1 Or p2 Then
            pdfOK = pdfOK + 1
        Else
            pdfFail = pdfFail + 1
        End If

        swApp.CloseDoc swDoc2.GetPathName
        Set swDoc2 = Nothing

NextDrw:
    Next j

    ' --- Report finale ---
    logMsg = logMsg & vbCrLf & "================================" & vbCrLf
    logMsg = logMsg & "COMPLETATO" & vbCrLf
    logMsg = logMsg & "  GLB esportati: " & glbOK & " (errori: " & glbFail & ")" & vbCrLf
    logMsg = logMsg & "  PDF esportati: " & pdfOK & " (errori: " & pdfFail & ")" & vbCrLf

    ' Salva log
    Dim logPath As String
    logPath = "C:\Users\Marco Redaelli\VISUAL STUDIO CODE\3D editor in code\tools\export_bvl_glb_pdf_log.txt"
    Dim f As Integer
    f = FreeFile
    Open logPath For Output As #f
    Print #f, logMsg
    Close #f

    MsgBox logMsg, vbInformation, "Export BVL GLB+PDF completato"

End Sub

' --- Esporta come GLB ---
Function ExportGLB(swDoc As SldWorks.ModelDoc2, outputPath As String) As Boolean
    Dim errors As Long
    Dim warnings As Long

    Dim result As Boolean
    result = swDoc.Extension.SaveAs(outputPath, 0, swSaveAsOptions_Silent, Nothing, errors, warnings)

    If result And fso.FileExists(outputPath) Then
        ExportGLB = True
        Exit Function
    End If

    Dim result2 As Long
    result2 = swDoc.SaveAs3(outputPath, 0, swSaveAsOptions_Silent)

    If fso.FileExists(outputPath) Then
        ExportGLB = True
        Exit Function
    End If

    On Error Resume Next
    result = swDoc.Extension.SaveAs2(outputPath, 0, swSaveAsOptions_Silent, Nothing, "", False, errors, warnings)
    On Error GoTo 0

    If fso.FileExists(outputPath) Then
        ExportGLB = True
        Exit Function
    End If

    ExportGLB = False
End Function

' --- Esporta come PDF ---
Function ExportPDF(swDoc As SldWorks.ModelDoc2, outputPath As String) As Boolean
    Dim errors As Long
    Dim warnings As Long

    Dim swExportData As SldWorks.ExportPdfData
    Set swExportData = swApp.GetExportFileData(swExportPdfData)

    If Not swExportData Is Nothing Then
        swExportData.ViewPdfAfterSaving = False
    End If

    Dim result As Boolean
    result = swDoc.Extension.SaveAs(outputPath, 0, swSaveAsOptions_Silent, swExportData, errors, warnings)

    If result And fso.FileExists(outputPath) Then
        ExportPDF = True
        Exit Function
    End If

    Dim result2 As Long
    result2 = swDoc.SaveAs3(outputPath, 0, swSaveAsOptions_Silent)

    If fso.FileExists(outputPath) Then
        ExportPDF = True
        Exit Function
    End If

    ExportPDF = False
End Function

' --- Raccolta ricorsiva file per estensione ---
Sub CollectFiles(folderPath As String, ext As String, ByRef names() As String, ByRef paths() As String, ByRef count As Long)
    Dim folder As Object
    Dim file As Object
    Dim subFolder As Object

    If Not fso.FolderExists(folderPath) Then Exit Sub

    Set folder = fso.GetFolder(folderPath)

    ' File nella cartella corrente
    For Each file In folder.files
        If UCase(fso.GetExtensionName(file.Name)) = UCase(ext) Then
            ' Escludi cartelle non desiderate
            If InStr(LCase(folderPath), "obsolet") = 0 And _
               InStr(LCase(folderPath), "costruttivo") = 0 And _
               InStr(LCase(folderPath), "fornitore") = 0 And _
               InStr(LCase(folderPath), "osca") = 0 And _
               InStr(LCase(folderPath), "personalizzat") = 0 Then

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

    ' Sottocartelle (ricorsivo) - solo VL* e cartelle principali
    For Each subFolder In folder.SubFolders
        Dim subName As String
        subName = LCase(subFolder.Name)
        If Left(subName, 2) = "vl" Or _
           subName = "basi lineari" Or _
           subName = "coperchi lineari" Or _
           subName = "elementi per basi" Then
            CollectFiles subFolder.Path, ext, names, paths, count
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
