// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { useState } from 'react';

import { useNavigate } from 'react-router-dom';

import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import ContentLayout from '@cloudscape-design/components/content-layout';
import FileUpload from '@cloudscape-design/components/file-upload';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Header from '@cloudscape-design/components/header';
import Select, { SelectProps } from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Spinner from '@cloudscape-design/components/spinner';

import * as pdfjsLib from 'pdfjs-dist';
import { Progress } from '@aws-sdk/lib-storage';
import mammoth from 'mammoth';
import Papa from 'papaparse';

import { DocumentAnalysisJob } from '@/components/Documents/Documents';
import { useS3 } from '@/hooks/useS3';
import { useNotificationsContext } from '@/store/notifications';
import { detectEntitiesFromComprehendMedical, getInferredData } from '@/utils/ComprehendMedicalApi';
import { fileDownload, fileUpload } from '@/utils/S3Api';

// Type definitions for medical entities and results
interface MedicalEntity {
    Text?: string;
    Type?: string;
    Category?: string;
    Score?: number;
    BeginOffset?: number;
    EndOffset?: number;
    Attributes?: Array<{
        Type?: string;
        Score?: number;
    }>;
}

interface TextItem {
    str?: string;
}

interface CSVRow {
    [key: string]: unknown;
}

interface ComprehendResult {
    Entities?: MedicalEntity[];
    [key: string]: unknown;
}

// Configure PDF.js worker - use a more robust approach
if (typeof window !== 'undefined') {
    // Try to use a local worker first, then fallback to CDN
    try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
    } catch {
        // Use the correct CDN URL for the installed version
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
    }
}

const ANALYSIS_TYPE_OPTIONS = [
    {
        label: 'Medical Entities',
        value: 'ENTITIES',
        description: 'Detect medical entities like conditions, medications, and anatomy',
    },
    { label: 'ICD-10-CM', value: 'ICD10CM', description: 'Infer ICD-10-CM medical codes' },
    { label: 'RxNorm', value: 'RXNORM', description: 'Infer RxNorm medication codes' },
    { label: 'SNOMED CT', value: 'SNOMEDCT', description: 'Infer SNOMED CT medical concepts' },
];

export default function NewDocument() {
    const navigate = useNavigate();
    const { addFlashMessage, updateProgressBar } = useNotificationsContext();
    const [outputBucket, getUploadMetadata] = useS3();

    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [analysisType, setAnalysisType] = useState<SelectProps.Option | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleFileChange = ({ detail }: { detail: { value: File[] } }) => {
        setSelectedFiles(detail.value);
    };

    const handleAnalysisTypeChange = ({ detail }: { detail: { selectedOption: SelectProps.Option } }) => {
        setAnalysisType(detail.selectedOption);
    };

    /**
     * Extract text from different file types with comprehensive support
     */
    const extractTextFromFile = async (file: File): Promise<string> => {
        const fileType = file.type.toLowerCase();
        const fileName = file.name.toLowerCase();

        try {
            // PDF files
            if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
                return await extractTextFromPDF(file);
            }

            // Word documents (.docx)
            else if (
                fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                fileName.endsWith('.docx')
            ) {
                return await extractTextFromWordDocument(file);
            }

            // CSV files
            else if (fileType === 'text/csv' || fileName.endsWith('.csv')) {
                return await extractTextFromCSV(file);
            }

            // Plain text files
            else if (fileType.startsWith('text/') || fileName.endsWith('.txt')) {
                return await extractTextFromTextFile(file);
            }

            // Unknown file type
            else {
                throw new Error(
                    `Unsupported file type: ${fileType || 'unknown'}. Supported formats: PDF, DOCX, CSV, TXT`
                );
            }
        } catch (error) {
            console.error('Text extraction error:', error);
            throw error;
        }
    };

    /**
     * Extract text from PDF files using PDF.js
     */
    const extractTextFromPDF = async (file: File): Promise<string> => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdfDocument = await pdfjsLib.getDocument(arrayBuffer).promise;
            let extractedText = '';

            console.log(`Processing PDF with ${pdfDocument.numPages} pages`);

            for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
                const page = await pdfDocument.getPage(pageNum);
                const textContent = await page.getTextContent();

                // Extract text items and join them
                const pageText = textContent.items
                    .map((item: unknown) => (item as { str?: string })?.str || '')
                    .join(' ')
                    .trim();

                if (pageText) {
                    extractedText += `\n--- Page ${pageNum} ---\n${pageText}\n`;
                }
            }

            if (!extractedText.trim()) {
                throw new Error('No text content found in PDF. This may be a scanned document or image-based PDF.');
            }

            console.log(`Extracted ${extractedText.length} characters from PDF`);
            return extractedText.trim();
        } catch (error) {
            if (error instanceof Error && error.message.includes('No text content found')) {
                throw error;
            }
            throw new Error(
                `PDF processing failed: ${error instanceof Error ? error.message : 'Unknown error'}. Try converting to a text file instead.`
            );
        }
    };

    /**
     * Extract text from Word documents (.docx) using mammoth
     */
    const extractTextFromWordDocument = async (file: File): Promise<string> => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });

            if (!result.value || result.value.trim().length === 0) {
                throw new Error('No text content found in Word document.');
            }

            console.log(`Extracted ${result.value.length} characters from Word document`);

            // Include any warnings in console
            if (result.messages && result.messages.length > 0) {
                console.warn('Word document extraction warnings:', result.messages);
            }

            return result.value.trim();
        } catch (error) {
            throw new Error(
                `Word document processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    };

    /**
     * Extract text from CSV files by converting to readable format
     */
    const extractTextFromCSV = async (file: File): Promise<string> => {
        try {
            const csvText = await extractTextFromTextFile(file);

            // Parse CSV and convert to readable text
            const parsed = Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                transformHeader: (header: string) => header.trim(),
            });

            if (parsed.errors && parsed.errors.length > 0) {
                console.warn('CSV parsing warnings:', parsed.errors);
            }

            if (!parsed.data || parsed.data.length === 0) {
                throw new Error('No data found in CSV file.');
            }

            // Convert CSV data to readable text format
            let extractedText = '';
            const data = parsed.data as CSVRow[];

            data.forEach((row, index) => {
                const rowText = Object.entries(row)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join(', ');
                extractedText += `Record ${index + 1}: ${rowText}\n`;
            });

            if (!extractedText.trim()) {
                throw new Error('No readable data found in CSV file.');
            }

            console.log(`Converted ${data.length} CSV records to text (${extractedText.length} characters)`);
            return extractedText.trim();
        } catch (error) {
            throw new Error(`CSV processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    /**
     * Extract text from plain text files
     */
    const extractTextFromTextFile = async (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target?.result as string;
                if (!text || text.trim().length === 0) {
                    reject(new Error('Text file appears to be empty.'));
                } else {
                    resolve(text);
                }
            };
            reader.onerror = () => reject(new Error('Failed to read text file.'));
            reader.readAsText(file, 'UTF-8');
        });
    };

    /**
     * Split text into chunks that are small enough for Comprehend Medical
     */
    const splitTextIntoChunks = (text: string, maxChunkSize: number = 4000, overlap: number = 200): string[] => {
        if (text.length <= maxChunkSize) {
            return [text];
        }

        const chunks: string[] = [];
        let startIndex = 0;

        while (startIndex < text.length) {
            let endIndex = startIndex + maxChunkSize;

            if (endIndex < text.length) {
                const searchStart = Math.max(startIndex + maxChunkSize - 500, startIndex);
                const chunkText = text.substring(searchStart, endIndex);
                const sentenceBreak = chunkText.search(/[.!?]\s+(?=[A-Z])|(\n\s*\n)/g);
                if (sentenceBreak !== -1) {
                    endIndex = searchStart + sentenceBreak + 1;
                }
            }

            chunks.push(text.substring(startIndex, endIndex));

            if (endIndex >= text.length) {
                break;
            }
            startIndex = Math.max(endIndex - overlap, startIndex + 1);
        }

        return chunks;
    };

    /**
     * Remove duplicate entities that might appear in overlapping chunks
     */
    const deduplicateEntities = (entities: MedicalEntity[]): MedicalEntity[] => {
        const seen = new Map<string, boolean>();
        const deduplicated: MedicalEntity[] = [];

        for (const entity of entities) {
            const key = `${entity.Text?.toLowerCase()}_${entity.Type}_${entity.Category}`;

            if (!seen.has(key)) {
                seen.set(key, true);
                deduplicated.push(entity);
            } else {
                const existingIndex = deduplicated.findIndex(
                    (e) => `${e.Text?.toLowerCase()}_${e.Type}_${e.Category}` === key
                );

                if (
                    existingIndex !== -1 &&
                    entity.Score &&
                    deduplicated[existingIndex].Score &&
                    entity.Score > deduplicated[existingIndex].Score!
                ) {
                    deduplicated[existingIndex] = entity;
                }
            }
        }

        return deduplicated;
    };

    /**
     * Combine results from multiple Comprehend Medical calls
     */
    const combineResults = (results: Array<Record<string, unknown>>, analysisType: string) => {
        if (results.length === 0) return null;
        if (results.length === 1) return results[0];

        const combined = { ...results[0] };

        if (analysisType === 'ENTITIES') {
            const allEntities = results.flatMap((result) => (result.Entities as MedicalEntity[]) || []);
            combined.Entities = deduplicateEntities(allEntities);
        } else {
            const allEntities = results.flatMap((result) => (result.Entities as MedicalEntity[]) || []);
            combined.Entities = deduplicateEntities(allEntities);
        }

        return combined;
    };

    /**
     * Process document with Comprehend Medical after it's uploaded to S3
     */
    const processDocumentAsync = async (documentId: string, s3Key: string, analysisTypeValue: string) => {
        try {
            console.log(`Starting async processing for document ${documentId}`);

            // Download file from S3 and extract text
            const fileContent = await fileDownload(s3Key);
            const extractedText = fileContent;

            // If it looks like PDF content, try to parse it (fallback)
            if (fileContent.startsWith('%PDF')) {
                console.warn('File appears to be PDF content, but was not processed as PDF during upload');
                // For now, we'll leave it as is since proper PDF processing should happen during upload
            }

            // Split into chunks if needed
            const chunks = splitTextIntoChunks(extractedText);
            console.log(`Document split into ${chunks.length} chunks for processing`);

            // Process each chunk
            const results = [];

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                console.log(`Processing chunk ${i + 1} of ${chunks.length}`);

                try {
                    let chunkResult;
                    if (analysisTypeValue === 'ENTITIES') {
                        chunkResult = await detectEntitiesFromComprehendMedical(chunk);
                    } else {
                        const ontologyMap: { [key: string]: string } = {
                            ICD10CM: 'icd10cm',
                            RXNORM: 'rxnorm',
                            SNOMEDCT: 'snomedct',
                        };
                        chunkResult = await getInferredData(ontologyMap[analysisTypeValue], chunk);
                    }

                    if (chunkResult) {
                        results.push(chunkResult);
                    }
                } catch (chunkError) {
                    console.warn(`Error processing chunk ${i + 1}:`, chunkError);
                }
            }

            // Combine results
            const combinedResults = combineResults(
                results.filter(Boolean) as unknown as Array<Record<string, unknown>>,
                analysisTypeValue
            );

            if (!combinedResults) {
                throw new Error('No results were obtained from any text chunks');
            }

            // Store the raw results and combined results
            const processingResults = {
                combinedResults,
                rawResults: results,
                extractedText,
                chunkCount: chunks.length,
                processedAt: new Date().toISOString(),
            };

            // Update document status to completed
            const existingJobs = JSON.parse(localStorage.getItem('documentAnalysisJobs') || '[]');
            const jobIndex = existingJobs.findIndex((job: DocumentAnalysisJob) => job.id === documentId);

            if (jobIndex !== -1) {
                existingJobs[jobIndex] = {
                    ...existingJobs[jobIndex],
                    status: 'COMPLETED',
                    completionTime: new Date(),
                    results: processingResults,
                };
                localStorage.setItem('documentAnalysisJobs', JSON.stringify(existingJobs));
                console.log(`Document ${documentId} processing completed successfully`);
            }
        } catch (error) {
            console.error(`Error processing document ${documentId}:`, error);

            // Update document status to failed
            const existingJobs = JSON.parse(localStorage.getItem('documentAnalysisJobs') || '[]');
            const jobIndex = existingJobs.findIndex((job: DocumentAnalysisJob) => job.id === documentId);

            if (jobIndex !== -1) {
                existingJobs[jobIndex] = {
                    ...existingJobs[jobIndex],
                    status: 'FAILED',
                    completionTime: new Date(),
                    errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
                };
                localStorage.setItem('documentAnalysisJobs', JSON.stringify(existingJobs));
            }
        }
    };

    /**
     * Upload progress callback
     */
    function s3UploadCallback({ loaded, total }: Progress, fileName: string) {
        const value = Math.round(((loaded || 1) / (total || 100)) * 100);
        const loadedKb = Math.round((loaded || 1) / 1024);
        const totalKb = Math.round((total || 1) / 1024);
        updateProgressBar({
            id: `Document Upload: ${fileName}`,
            value: value,
            description: `Uploading ${loadedKb}KB / ${totalKb}KB`,
        });
    }

    const handleSubmit = async () => {
        if (selectedFiles.length === 0 || !analysisType) {
            addFlashMessage({
                id: 'validation-error',
                header: 'Validation Error',
                content: 'Please select a file and analysis type.',
                type: 'error',
            });
            return;
        }

        setIsUploading(true);

        try {
            const file = selectedFiles[0];
            const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Extract text content first
            let extractedText = '';
            const contentType = 'text/plain';

            try {
                updateProgressBar({
                    id: `Document Upload: ${file.name}`,
                    value: 0,
                    description: 'Extracting text content...',
                });

                extractedText = await extractTextFromFile(file);
                console.log(`Extracted ${extractedText.length} characters from ${file.name}`);
            } catch (extractError) {
                console.error('Error extracting text:', extractError);

                let errorMessage = 'Failed to extract text from the document.';
                if (extractError instanceof Error) {
                    if (extractError.message.includes('Unsupported file type')) {
                        errorMessage = extractError.message + ' Please select a supported file format.';
                    } else if (extractError.message.includes('PDF processing failed')) {
                        errorMessage =
                            'PDF text extraction failed. This may be a scanned or image-based PDF. Try: 1) Using a different PDF, 2) Converting to .txt format, or 3) Using OCR software to extract text first.';
                    } else if (extractError.message.includes('Word document processing failed')) {
                        errorMessage =
                            'Word document processing failed. Please ensure the file is a valid .docx format or try converting to .txt format.';
                    } else if (extractError.message.includes('CSV processing failed')) {
                        errorMessage =
                            'CSV processing failed. Please ensure the file is a valid CSV format with proper headers.';
                    } else if (extractError.message.includes('No text content found')) {
                        errorMessage =
                            extractError.message + ' Please try a different file or convert to .txt format manually.';
                    } else {
                        errorMessage = extractError.message;
                    }
                }

                addFlashMessage({
                    id: 'extract-error',
                    header: 'Text Extraction Error',
                    content: errorMessage,
                    type: 'error',
                });
                setIsUploading(false);
                return;
            }

            // Get S3 upload location
            const uploadLocation = getUploadMetadata();
            const s3Location = {
                Bucket: uploadLocation.bucket,
                Key: `${uploadLocation.key}/${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`, // Sanitize filename
            };

            // Create document job with IN_PROGRESS status
            const documentJob: DocumentAnalysisJob = {
                id: documentId,
                fileName: file.name,
                status: 'IN_PROGRESS',
                uploadTime: new Date(),
                fileSize: file.size,
                analysisType: analysisType.value as 'ENTITIES' | 'ICD10CM' | 'RXNORM' | 'SNOMEDCT',
                s3Key: s3Location.Key,
                s3Bucket: s3Location.Bucket,
                s3Uri: `s3://${s3Location.Bucket}/${s3Location.Key}`,
            };

            // Save document job to localStorage
            const existingJobs = JSON.parse(localStorage.getItem('documentAnalysisJobs') || '[]');
            existingJobs.push(documentJob);
            localStorage.setItem('documentAnalysisJobs', JSON.stringify(existingJobs));

            updateProgressBar({
                id: `Document Upload: ${file.name}`,
                value: 10,
                description: 'Uploading extracted text to S3...',
            });

            // Upload the extracted text to S3 (much faster than original file)
            const textBlob = new Blob([extractedText], { type: 'text/plain' });
            const textFile = new File([textBlob], `extracted_${file.name}.txt`, { type: 'text/plain' });

            await fileUpload({
                ...s3Location,
                Body: textFile,
                ContentType: 'text/plain',
                callbackFn: (progress) => s3UploadCallback(progress, file.name),
            });

            updateProgressBar({
                id: `Document Upload: ${file.name}`,
                type: 'success',
                value: 100,
                description: 'Upload complete - processing started',
                additionalInfo:
                    'Your document has been uploaded and is now being processed with Amazon Comprehend Medical.',
            });

            addFlashMessage({
                id: 'upload-success',
                header: 'Upload Complete',
                content: `${file.name} has been uploaded successfully. Processing with ${analysisType.label} has started.`,
                type: 'success',
            });

            // Start async processing (don't await - let it run in background)
            processDocumentAsync(documentId, s3Location.Key, analysisType.value || '').catch((error) => {
                console.error('Background processing failed:', error);
                addFlashMessage({
                    id: 'processing-error',
                    header: 'Processing Error',
                    content: `Background processing failed for ${file.name}: ${error.message}`,
                    type: 'error',
                });
            });

            // Navigate to documents page to show the processing job
            navigate('/documents');
        } catch (error) {
            console.error('Error uploading document:', error);

            let errorMessage = 'An unexpected error occurred during upload';
            if (error instanceof Error) {
                errorMessage = error.message;
            }

            updateProgressBar({
                id: `Document Upload: ${selectedFiles[0]?.name || 'Document'}`,
                type: 'error',
                value: 0,
                description: 'Upload failed',
                additionalInfo: `Error: ${errorMessage}`,
            });

            addFlashMessage({
                id: 'upload-error',
                header: 'Upload Error',
                content: `Failed to upload document: ${errorMessage}`,
                type: 'error',
            });
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <ContentLayout
            headerVariant="high-contrast"
            header={
                <Header
                    variant="awsui-h1-sticky"
                    description="Upload documents (PDF, DOCX, CSV, TXT) for analysis with Amazon Comprehend Medical"
                >
                    New Document Analysis
                </Header>
            }
        >
            <Container>
                <Form
                    actions={
                        <SpaceBetween direction="horizontal" size="xs">
                            <Button variant="link" onClick={() => navigate('/documents')}>
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleSubmit}
                                disabled={isUploading || selectedFiles.length === 0 || !analysisType}
                            >
                                {isUploading ? <Spinner /> : 'Upload and Analyze'}
                            </Button>
                        </SpaceBetween>
                    }
                >
                    <SpaceBetween direction="vertical" size="l">
                        <Alert statusIconAriaLabel="Info">
                            Upload a document (TXT, PDF, DOCX, CSV) for fast analysis with Amazon Comprehend Medical.
                            Files are uploaded to S3 first, then processed in the background. You can view the
                            processing status on the Documents page.
                            <br />
                            <br />
                            <strong>Supported formats:</strong>
                            <ul>
                                <li>
                                    <strong>PDF:</strong> Text-based PDFs work best. Scanned/image PDFs may not extract
                                    text properly.
                                </li>
                                <li>
                                    <strong>DOCX:</strong> Microsoft Word documents (.docx format only)
                                </li>
                                <li>
                                    <strong>CSV:</strong> Comma-separated values - will be converted to readable text
                                    format
                                </li>
                                <li>
                                    <strong>TXT:</strong> Plain text files
                                </li>
                            </ul>
                            If text extraction fails, you can manually convert your document to .txt format as a
                            fallback.
                        </Alert>

                        <FormField label="Document File" description="Select a document to upload and analyze">
                            <FileUpload
                                onChange={handleFileChange}
                                value={selectedFiles}
                                i18nStrings={{
                                    uploadButtonText: (e) => (e ? 'Choose files' : 'Choose file'),
                                    dropzoneText: (e) => (e ? 'Drop files to upload' : 'Drop file to upload'),
                                    removeFileAriaLabel: (e) => `Remove file ${e + 1}`,
                                    limitShowFewer: 'Show fewer files',
                                    limitShowMore: 'Show more files',
                                    errorIconAriaLabel: 'Error',
                                }}
                                multiple={false}
                                accept=".txt,.pdf,.docx,.csv"
                                showFileLastModified
                                showFileSize
                                showFileThumbnail
                                constraintText="Supported formats: TXT, PDF, DOCX, CSV. Maximum file size recommended: 10MB."
                            />
                        </FormField>

                        <FormField label="Analysis Type" description="Choose the type of medical analysis to perform">
                            <Select
                                selectedOption={analysisType}
                                onChange={handleAnalysisTypeChange}
                                options={ANALYSIS_TYPE_OPTIONS}
                                placeholder="Select analysis type"
                            />
                        </FormField>
                    </SpaceBetween>
                </Form>
            </Container>
        </ContentLayout>
    );
}
