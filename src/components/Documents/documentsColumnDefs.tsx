// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React from 'react';

import { Link } from 'react-router-dom';

import StatusIndicator from '@cloudscape-design/components/status-indicator';
import TextContent from '@cloudscape-design/components/text-content';

import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

import toTitleCase from '@/utils/toTitleCase';

import { DocumentAnalysisJob } from './Documents';

dayjs.extend(duration);

function DocumentName(document: DocumentAnalysisJob) {
    if (document.status === 'COMPLETED') {
        return (
            <TextContent>
                <Link to={`/document/${document.id}`}>{document.fileName}</Link>
            </TextContent>
        );
    } else {
        return document.fileName;
    }
}

function DocumentStatus(status: string, uploadTime?: Date) {
    switch (status) {
        case 'COMPLETED':
            return <StatusIndicator>Completed</StatusIndicator>;
        case 'FAILED':
            return <StatusIndicator type="error">Failed</StatusIndicator>;
        case 'IN_PROGRESS': {
            const processingTime = uploadTime ? dayjs.duration(Date.now() - uploadTime.getTime()).format('mm:ss') : '';
            return (
                <StatusIndicator type="in-progress">
                    Processing {processingTime && `(${processingTime})`}
                </StatusIndicator>
            );
        }
        case 'PENDING':
            return <StatusIndicator type="pending">Pending</StatusIndicator>;
        default:
            return <StatusIndicator type="info">{toTitleCase(status)}</StatusIndicator>;
    }
}

function AnalysisType(analysisType: string) {
    switch (analysisType) {
        case 'ENTITIES':
            return 'Medical Entities';
        case 'ICD10CM':
            return 'ICD-10-CM';
        case 'RXNORM':
            return 'RxNorm';
        case 'SNOMEDCT':
            return 'SNOMED CT';
        default:
            return analysisType;
    }
}

function FileSize(sizeInBytes: number) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = sizeInBytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export const columnDefs = [
    {
        id: 'fileName',
        header: 'File Name',
        cell: (e: DocumentAnalysisJob) => DocumentName(e),
        sortingField: 'fileName',
        width: 300,
    },
    {
        id: 'status',
        header: 'Status',
        cell: (e: DocumentAnalysisJob) => DocumentStatus(e.status, e.uploadTime),
        sortingField: 'status',
    },
    {
        id: 'analysisType',
        header: 'Analysis Type',
        cell: (e: DocumentAnalysisJob) => AnalysisType(e.analysisType),
        sortingField: 'analysisType',
    },
    {
        id: 'uploadTime',
        header: 'Uploaded',
        cell: (e: DocumentAnalysisJob) => dayjs(e.uploadTime).format('MMMM D YYYY, H:mm'),
        sortingField: 'uploadTime',
    },
    {
        id: 'fileSize',
        header: 'File Size',
        cell: (e: DocumentAnalysisJob) => FileSize(e.fileSize),
        sortingField: 'fileSize',
    },
    // objects below here are not shown by default
    {
        id: 'completionTime',
        header: 'Completed',
        cell: (e: DocumentAnalysisJob) =>
            e.completionTime ? dayjs(e.completionTime).format('MMMM D YYYY, H:mm') : '-',
        sortingField: 'completionTime',
    },
    {
        id: 'duration',
        header: 'Duration',
        cell: (e: DocumentAnalysisJob) =>
            e.completionTime && e.uploadTime
                ? dayjs.duration(e.completionTime.getTime() - e.uploadTime.getTime()).format('mm:ss')
                : '-',
        sortingField: 'duration',
    },
    {
        id: 'errorMessage',
        header: 'Error Message',
        cell: (e: DocumentAnalysisJob) => e.errorMessage || '-',
        sortingField: 'errorMessage',
    },
];
