// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React, { useState } from 'react';

import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Spinner from '@cloudscape-design/components/spinner';

import { useNotificationsContext } from '@/store/notifications';

import { DocumentAnalysisJob } from './Documents';

type DeleteDocumentProps = {
    selectedDocument: DocumentAnalysisJob[];
    deleteModalActive: boolean;
    setDeleteModalActive: React.Dispatch<React.SetStateAction<boolean>>;
    refreshTable: () => void;
};

export function DeleteDocument({
    selectedDocument,
    deleteModalActive,
    setDeleteModalActive,
    refreshTable,
}: DeleteDocumentProps) {
    const { addFlashMessage } = useNotificationsContext();
    const [isDeleting, setIsDeleting] = useState<boolean>(false);

    async function doDelete(documentId: string) {
        if (!documentId) return;
        setIsDeleting(true);
        try {
            // Remove from localStorage (in a real app this would be an API call)
            const storedDocuments = localStorage.getItem('documentAnalysisJobs');
            if (storedDocuments) {
                const documents = JSON.parse(storedDocuments);
                const updatedDocuments = documents.filter((doc: DocumentAnalysisJob) => doc.id !== documentId);
                localStorage.setItem('documentAnalysisJobs', JSON.stringify(updatedDocuments));
            }

            addFlashMessage({
                id: `document-deleted-${documentId}`,
                header: 'Document deleted',
                content: 'Document analysis job has been deleted successfully.',
                type: 'success',
            });

            refreshTable();
        } catch (err) {
            addFlashMessage({
                id: err?.toString() || 'Error deleting document',
                header: 'Error deleting document',
                content: err?.toString() || 'Error deleting document analysis job',
                type: 'error',
            });
        }
        setDeleteModalActive(false);
        setIsDeleting(false);
    }

    return (
        <Modal
            onDismiss={() => setDeleteModalActive(false)}
            visible={deleteModalActive}
            footer={
                <Box float="right">
                    <SpaceBetween direction="horizontal" size="xs">
                        <Button variant="link" disabled={isDeleting} onClick={() => setDeleteModalActive(false)}>
                            Cancel
                        </Button>
                        <Button
                            disabled={isDeleting}
                            variant="primary"
                            onClick={() => doDelete(selectedDocument?.[0]?.id || '')}
                        >
                            {isDeleting ? <Spinner /> : 'Delete'}
                        </Button>
                    </SpaceBetween>
                </Box>
            }
            header="Delete Document Analysis Job"
        >
            <p>
                Permanently delete <strong>{selectedDocument?.[0]?.fileName || ''}</strong>. You cannot undo this
                action.
            </p>
            <Alert statusIconAriaLabel="Info">
                Proceeding with this action will delete the document analysis job but not the associated file from S3.
            </Alert>
        </Modal>
    );
}
