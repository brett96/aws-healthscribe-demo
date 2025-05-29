// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useCollection } from '@cloudscape-design/collection-hooks';
import Button from '@cloudscape-design/components/button';
import { CollectionPreferencesProps } from '@cloudscape-design/components/collection-preferences';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import Pagination from '@cloudscape-design/components/pagination';
import Table from '@cloudscape-design/components/table';

import { DocumentsFilter } from '@/components/Documents/DocumentsFilter';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useNotificationsContext } from '@/store/notifications';

import { DocumentsHeaderActions } from './DocumentsHeaderActions';
import TableEmptyState from './TableEmptyState';
import { TablePreferences } from './TablePreferences';
import { columnDefs } from './documentsColumnDefs';
import { DEFAULT_PREFERENCES } from './documentsPrefs';

// Type definitions for document results
interface DocumentResults {
    combinedResults?: {
        Entities?: Array<Record<string, unknown>>;
        [key: string]: unknown;
    };
    rawResults?: Array<Record<string, unknown>>;
    extractedText?: string;
    chunkCount?: number;
    processedAt?: string;
    Entities?: Array<Record<string, unknown>>;
    [key: string]: unknown;
}

// Document analysis job type
export type DocumentAnalysisJob = {
    id: string;
    fileName: string;
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
    uploadTime: Date;
    completionTime?: Date;
    fileSize: number;
    analysisType: 'ENTITIES' | 'ICD10CM' | 'RXNORM' | 'SNOMEDCT';
    s3Key: string;
    s3Bucket?: string;
    s3Uri?: string;
    results?: DocumentResults;
    errorMessage?: string;
};

type SearchFilter = {
    fileName?: string;
    status?: string;
    analysisType?: string;
};

export default function Documents() {
    const { addFlashMessage } = useNotificationsContext();

    const [documents, setDocuments] = useState<DocumentAnalysisJob[]>([]); // Documents from storage
    const [selectedDocument, setSelectedDocument] = useState<DocumentAnalysisJob[] | []>([]); // Selected document

    const [tableLoading, setTableLoading] = useState(false); // Loading state for table

    const [preferences, setPreferences] = useLocalStorage<CollectionPreferencesProps.Preferences>(
        'Documents-Table-Preferences',
        DEFAULT_PREFERENCES
    ); // Document table preferences

    const [searchParams, setSearchParams] = useState<SearchFilter>({});

    // Header counter for the number of documents
    const headerCounterText = `(${documents.length})`;

    // Load documents from localStorage or API
    const loadDocuments = useCallback(async () => {
        setTableLoading(true);
        try {
            // For now, load from localStorage - in a real app this would be from an API
            const storedDocuments = localStorage.getItem('documentAnalysisJobs');
            if (storedDocuments) {
                const parsedDocuments = JSON.parse(storedDocuments).map((doc: Partial<DocumentAnalysisJob>) => ({
                    ...doc,
                    uploadTime: new Date(doc.uploadTime!),
                    completionTime: doc.completionTime ? new Date(doc.completionTime) : undefined,
                }));
                setDocuments(parsedDocuments as DocumentAnalysisJob[]);
            } else {
                setDocuments([]);
            }
        } catch (e: unknown) {
            setTableLoading(false);
            const errorMessage = e instanceof Error ? e.message : 'Unknown error';
            addFlashMessage({
                id: errorMessage,
                header: 'Documents Error',
                content: errorMessage,
                type: 'error',
            });
        }
        setTableLoading(false);
    }, [addFlashMessage]);

    // Filter documents based on search params
    const filteredDocuments = useMemo(() => {
        return documents.filter((doc) => {
            if (searchParams.fileName && !doc.fileName.toLowerCase().includes(searchParams.fileName.toLowerCase())) {
                return false;
            }
            if (searchParams.status && searchParams.status !== 'ALL' && doc.status !== searchParams.status) {
                return false;
            }
            if (
                searchParams.analysisType &&
                searchParams.analysisType !== 'ALL' &&
                doc.analysisType !== searchParams.analysisType
            ) {
                return false;
            }
            return true;
        });
    }, [documents, searchParams]);

    // Refresh documents
    async function refreshTable() {
        await loadDocuments();
    }

    // Table collection
    const { items, actions, collectionProps, paginationProps } = useCollection(filteredDocuments, {
        filtering: {
            empty: <TableEmptyState title="No documents" subtitle="Upload a document to get started." />,
            noMatch: (
                <TableEmptyState
                    title="No matches"
                    subtitle="We cannot find a match."
                    action={<Button onClick={() => actions.setFiltering('')}>Clear filter</Button>}
                />
            ),
        },
        pagination: { pageSize: preferences.pageSize },
        sorting: {},
        selection: {},
    });

    // Load documents initially
    useEffect(() => {
        void refreshTable();
    }, []);

    // Auto-refresh for IN_PROGRESS documents
    useEffect(() => {
        const hasInProgressDocs = documents.some((doc) => doc.status === 'IN_PROGRESS');

        if (hasInProgressDocs) {
            const intervalId = setInterval(() => {
                console.log('Auto-refreshing documents to check for processing updates...');
                void refreshTable();
            }, 5000); // Refresh every 5 seconds

            return () => clearInterval(intervalId);
        }
    }, [documents, refreshTable]);

    return (
        <ContentLayout
            headerVariant={'high-contrast'}
            header={
                <Header
                    variant="awsui-h1-sticky"
                    description="View and manage your document analysis jobs"
                    counter={headerCounterText}
                    actions={<DocumentsHeaderActions selectedDocument={selectedDocument} refreshTable={refreshTable} />}
                >
                    Document Analysis
                </Header>
            }
        >
            <Table
                {...collectionProps}
                columnDefinitions={columnDefs}
                columnDisplay={preferences.contentDisplay}
                contentDensity={preferences.contentDensity}
                filter={<DocumentsFilter searchParams={searchParams} setSearchParams={setSearchParams} />}
                items={items}
                loading={tableLoading}
                loadingText="Loading documents"
                onSelectionChange={({ detail }) => setSelectedDocument(detail.selectedItems)}
                pagination={<Pagination {...paginationProps} />}
                preferences={<TablePreferences preferences={preferences} setPreferences={setPreferences} />}
                resizableColumns={true}
                selectedItems={selectedDocument}
                selectionType="single"
                stickyColumns={preferences.stickyColumns}
                stickyHeader={true}
                stripedRows={preferences.stripedRows}
                trackBy="id"
                variant="container"
                wrapLines={preferences.wrapLines}
            />
        </ContentLayout>
    );
}
