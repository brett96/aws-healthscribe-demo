// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { useEffect, useState } from 'react';

import { useNavigate, useParams } from 'react-router-dom';

import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Table from '@cloudscape-design/components/table';
import Textarea from '@cloudscape-design/components/textarea';

import { Attribute, Entity } from '@aws-sdk/client-comprehendmedical';

import { DocumentAnalysisJob } from '@/components/Documents/Documents';
import { useNotificationsContext } from '@/store/notifications';
import { fileDownload } from '@/utils/S3Api';

// Type definitions for document results
interface DocumentResults {
    combinedResults?: {
        Entities?: Entity[];
        [key: string]: unknown;
    };
    rawResults?: Array<Record<string, unknown>>;
    extractedText?: string;
    chunkCount?: number;
    processedAt?: string;
    Entities?: Entity[];
    [key: string]: unknown;
}

export default function Document() {
    const { documentId } = useParams<{ documentId: string }>();
    const navigate = useNavigate();
    const { addFlashMessage } = useNotificationsContext();

    const [document, setDocument] = useState<DocumentAnalysisJob | null>(null);
    const [documentContent, setDocumentContent] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [loadingContent, setLoadingContent] = useState(false);

    useEffect(() => {
        if (!documentId) {
            navigate('/documents');
            return;
        }

        // Load document metadata from localStorage
        const storedDocuments = localStorage.getItem('documentAnalysisJobs');
        if (storedDocuments) {
            const documents = JSON.parse(storedDocuments);
            const foundDocument = documents.find((doc: DocumentAnalysisJob) => doc.id === documentId);

            if (foundDocument) {
                const docWithDates = {
                    ...foundDocument,
                    uploadTime: new Date(foundDocument.uploadTime),
                    completionTime: foundDocument.completionTime ? new Date(foundDocument.completionTime) : undefined,
                };
                setDocument(docWithDates);

                // Load document content from S3 if available
                if (foundDocument.s3Key && foundDocument.s3Bucket) {
                    loadDocumentContent(foundDocument.s3Key);
                }
            } else {
                addFlashMessage({
                    id: 'document-not-found',
                    header: 'Document Not Found',
                    content: 'The requested document could not be found.',
                    type: 'error',
                });
                navigate('/documents');
            }
        } else {
            navigate('/documents');
        }
        setLoading(false);
    }, [documentId, navigate, addFlashMessage]);

    const loadDocumentContent = async (s3Key: string) => {
        setLoadingContent(true);
        try {
            const content = await fileDownload(s3Key);
            setDocumentContent(content);
        } catch (error) {
            console.error('Error loading document content:', error);
            addFlashMessage({
                id: 'content-load-error',
                header: 'Content Load Error',
                content: `Failed to load document content from S3: ${error}`,
                type: 'warning',
            });
        } finally {
            setLoadingContent(false);
        }
    };

    const renderDocumentContent = () => {
        if (!document?.s3Key || !document?.s3Bucket) {
            return (
                <Alert statusIconAriaLabel="Info">
                    Document content is not available (document was not uploaded to S3).
                </Alert>
            );
        }

        if (loadingContent) {
            return <StatusIndicator type="loading">Loading document content...</StatusIndicator>;
        }

        if (!documentContent) {
            return (
                <Alert statusIconAriaLabel="Warning" type="warning">
                    Document content could not be loaded from S3.
                </Alert>
            );
        }

        // If we have processing results with extracted text, show that instead
        const extractedText = document.results?.extractedText;
        const displayText = (extractedText as string) || documentContent;

        return (
            <SpaceBetween direction="vertical" size="m">
                {extractedText && (
                    <Alert statusIconAriaLabel="Info">
                        Showing extracted and processed text content from the original document.
                    </Alert>
                )}
                <Textarea value={displayText} readOnly rows={15} placeholder="Document content will appear here..." />
                {document.results?.chunkCount &&
                    typeof document.results.chunkCount === 'number' &&
                    document.results.chunkCount > 1 && (
                        <Box variant="small" color="text-status-info">
                            This document was processed in {document.results.chunkCount} chunks for analysis.
                        </Box>
                    )}
            </SpaceBetween>
        );
    };

    const renderResults = () => {
        if (!document?.results) {
            return <Alert statusIconAriaLabel="Info">No analysis results available for this document.</Alert>;
        }

        const results = document.results;

        // Use combinedResults if available, otherwise fall back to old structure
        const analysisResults = (results.combinedResults || results) as { Entities?: Entity[] };

        if (document.analysisType === 'ENTITIES') {
            // Display medical entities
            const entities = analysisResults.Entities || [];

            // Add unique IDs to entities to prevent React key conflicts
            const entitiesWithIds = entities.map((entity: Entity, index: number) => ({
                ...entity,
                uniqueId: `entity-${index}-${entity.BeginOffset || 0}-${entity.Text || ''}`.replace(/\s+/g, '-'),
            }));

            const entityColumns = [
                {
                    id: 'text',
                    header: 'Text',
                    cell: (item: Entity) => item.Text,
                },
                {
                    id: 'category',
                    header: 'Category',
                    cell: (item: Entity) => item.Category,
                },
                {
                    id: 'type',
                    header: 'Type',
                    cell: (item: Entity) => item.Type,
                },
                {
                    id: 'confidence',
                    header: 'Confidence',
                    cell: (item: Entity) => `${((item.Score || 0) * 100).toFixed(1)}%`,
                },
                {
                    id: 'traits',
                    header: 'Traits',
                    cell: (item: Entity) =>
                        item.Traits && item.Traits.length > 0
                            ? item.Traits.map(
                                  (trait) => `${trait.Name} (${((trait.Score || 0) * 100).toFixed(1)}%)`
                              ).join(', ')
                            : '-',
                },
            ];

            return (
                <SpaceBetween direction="vertical" size="l">
                    <Table
                        columnDefinitions={entityColumns}
                        items={entitiesWithIds}
                        loadingText="Loading entities"
                        trackBy="uniqueId"
                        empty={
                            <Box textAlign="center" color="inherit">
                                <b>No entities found</b>
                                <Box variant="p" padding={{ bottom: 's' }} color="inherit">
                                    No medical entities were detected in this document.
                                </Box>
                            </Box>
                        }
                        header={<Header>Medical Entities ({entities.length})</Header>}
                    />
                    {results.processedAt && typeof results.processedAt === 'string' && (
                        <Box variant="small" color="text-status-info">
                            Processed on {new Date(results.processedAt).toLocaleString()}
                        </Box>
                    )}
                </SpaceBetween>
            );
        } else {
            // Display inference results (ICD-10-CM, RxNorm, SNOMED CT)
            const entities = analysisResults.Entities || [];

            // Add unique IDs to entities to prevent React key conflicts
            const entitiesWithIds = entities.map((entity: Entity, index: number) => ({
                ...entity,
                uniqueId: `inference-${index}-${entity.BeginOffset || 0}-${entity.Text || ''}`.replace(/\s+/g, '-'),
            }));

            const inferenceColumns = [
                {
                    id: 'text',
                    header: 'Text',
                    cell: (item: Entity) => item.Text,
                },
                {
                    id: 'category',
                    header: 'Category',
                    cell: (item: Entity) => item.Category,
                },
                {
                    id: 'confidence',
                    header: 'Confidence',
                    cell: (item: Entity) => `${((item.Score || 0) * 100).toFixed(1)}%`,
                },
                {
                    id: 'concepts',
                    header: 'Medical Codes',
                    cell: (item: Entity) => {
                        if (item.Attributes && item.Attributes.length > 0) {
                            return item.Attributes.map(
                                (attr) => `${attr.Type}: ${attr.Score ? (attr.Score * 100).toFixed(1) + '%' : 'N/A'}`
                            ).join(', ');
                        }
                        return '-';
                    },
                },
            ];

            return (
                <SpaceBetween direction="vertical" size="l">
                    <Table
                        columnDefinitions={inferenceColumns}
                        items={entitiesWithIds}
                        loadingText="Loading results"
                        trackBy="uniqueId"
                        empty={
                            <Box textAlign="center" color="inherit">
                                <b>No results found</b>
                                <Box variant="p" padding={{ bottom: 's' }} color="inherit">
                                    No medical codes were inferred from this document.
                                </Box>
                            </Box>
                        }
                        header={
                            <Header>
                                {document.analysisType} Results ({entities.length})
                            </Header>
                        }
                    />
                    {results.processedAt && typeof results.processedAt === 'string' && (
                        <Box variant="small" color="text-status-info">
                            Processed on {new Date(results.processedAt).toLocaleString()}
                        </Box>
                    )}
                </SpaceBetween>
            );
        }
    };

    const renderRawOutput = () => {
        if (!document?.results) {
            return null;
        }

        const results = document.results;

        // Show raw results if available
        if (results.rawResults && Array.isArray(results.rawResults) && results.rawResults.length > 0) {
            return (
                <Container header={<Header>Raw Comprehend Medical Output</Header>}>
                    <SpaceBetween direction="vertical" size="m">
                        <Alert statusIconAriaLabel="Info">
                            This section shows the raw output from Amazon Comprehend Medical API calls.
                            {results.chunkCount && typeof results.chunkCount === 'number' && results.chunkCount > 1
                                ? ` The document was processed in ${results.chunkCount} chunks.`
                                : ''}
                        </Alert>
                        {results.rawResults.map((result: Record<string, unknown>, index: number) => (
                            <Container
                                key={`raw-result-${index}`}
                                header={
                                    <Header variant="h3">
                                        {results.chunkCount &&
                                        typeof results.chunkCount === 'number' &&
                                        results.chunkCount > 1
                                            ? `Chunk ${index + 1} of ${results.chunkCount}`
                                            : 'API Response'}
                                    </Header>
                                }
                            >
                                <Textarea
                                    value={JSON.stringify(result, null, 2)}
                                    readOnly
                                    rows={20}
                                    placeholder="Raw API response..."
                                />
                            </Container>
                        ))}
                    </SpaceBetween>
                </Container>
            );
        }

        // Fallback to show current results structure
        return (
            <Container header={<Header>Raw Output</Header>}>
                <Textarea value={JSON.stringify(results, null, 2)} readOnly rows={15} placeholder="Raw results..." />
            </Container>
        );
    };

    if (loading) {
        return (
            <ContentLayout headerVariant="high-contrast" header={<Header>Loading...</Header>}>
                <Container>
                    <StatusIndicator type="loading">Loading document...</StatusIndicator>
                </Container>
            </ContentLayout>
        );
    }

    if (!document) {
        return (
            <ContentLayout headerVariant="high-contrast" header={<Header>Document Not Found</Header>}>
                <Container>
                    <Alert statusIconAriaLabel="Error" type="error">
                        The requested document could not be found.
                    </Alert>
                </Container>
            </ContentLayout>
        );
    }

    return (
        <ContentLayout
            headerVariant="high-contrast"
            header={
                <Header
                    variant="awsui-h1-sticky"
                    description={`Analysis results for ${document.fileName}`}
                    actions={
                        <SpaceBetween direction="horizontal" size="s">
                            <Button onClick={() => navigate('/documents')}>Back to Documents</Button>
                        </SpaceBetween>
                    }
                >
                    {document.fileName}
                </Header>
            }
        >
            <SpaceBetween direction="vertical" size="l">
                <Container>
                    <SpaceBetween direction="vertical" size="m">
                        <div>
                            <Box variant="awsui-key-label">Status</Box>
                            <StatusIndicator type={document.status === 'COMPLETED' ? 'success' : 'error'}>
                                {document.status}
                            </StatusIndicator>
                        </div>
                        <div>
                            <Box variant="awsui-key-label">Analysis Type</Box>
                            <Box>{document.analysisType}</Box>
                        </div>
                        <div>
                            <Box variant="awsui-key-label">Upload Time</Box>
                            <Box>{document.uploadTime.toLocaleString()}</Box>
                        </div>
                        {document.completionTime && (
                            <div>
                                <Box variant="awsui-key-label">Completion Time</Box>
                                <Box>{document.completionTime.toLocaleString()}</Box>
                            </div>
                        )}
                        <div>
                            <Box variant="awsui-key-label">File Size</Box>
                            <Box>{(document.fileSize / 1024).toFixed(1)} KB</Box>
                        </div>
                    </SpaceBetween>
                </Container>

                <Container header={<Header>Original Document Content</Header>}>{renderDocumentContent()}</Container>

                <Container>{renderResults()}</Container>

                {renderRawOutput()}
            </SpaceBetween>
        </ContentLayout>
    );
}
