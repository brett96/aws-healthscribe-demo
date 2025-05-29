// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { useMemo, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';

import { DeleteDocument } from './DeleteDocument';
import { DocumentAnalysisJob } from './Documents';

type DocumentsHeaderActionsProps = {
    selectedDocument: DocumentAnalysisJob[];
    refreshTable: () => void;
};

export function DocumentsHeaderActions({ selectedDocument, refreshTable }: DocumentsHeaderActionsProps) {
    const navigate = useNavigate();

    const [deleteModalActive, setDeleteModalActive] = useState<boolean>(false);

    // Disable document action buttons if nothing is selected
    const actionButtonDisabled = useMemo(
        () => selectedDocument.length === 0 || !['COMPLETED', 'FAILED'].includes(selectedDocument[0].status),
        [selectedDocument]
    );

    const viewButtonDisabled = useMemo(
        () => selectedDocument.length === 0 || selectedDocument[0].status !== 'COMPLETED',
        [selectedDocument]
    );

    return (
        <>
            <DeleteDocument
                selectedDocument={selectedDocument}
                deleteModalActive={deleteModalActive}
                setDeleteModalActive={setDeleteModalActive}
                refreshTable={refreshTable}
            />
            <SpaceBetween direction="horizontal" size="s">
                <Button onClick={() => navigate('/new-document')} iconName="add-plus">
                    Upload New Document
                </Button>
                <Button onClick={() => refreshTable()} iconName="refresh" />
                <Button onClick={() => setDeleteModalActive(true)} disabled={actionButtonDisabled}>
                    Delete
                </Button>
                <Button
                    variant={'primary'}
                    disabled={viewButtonDisabled}
                    onClick={() => navigate(`/document/${selectedDocument[0].id}`)}
                >
                    View Results
                </Button>
            </SpaceBetween>
        </>
    );
}
