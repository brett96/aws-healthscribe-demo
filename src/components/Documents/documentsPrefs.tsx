// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { CollectionPreferencesProps } from '@cloudscape-design/components';

import { columnDefs } from './documentsColumnDefs';

export const collectionPreferencesProps = {
    preferences: {
        pageSize: 10,
        visibleContent: ['fileName', 'status', 'analysisType', 'uploadTime', 'fileSize'],
    },
    pageSizePreference: {
        title: 'Select page size',
        options: [
            { value: 10, label: '10 Documents' },
            { value: 20, label: '20 Documents' },
            { value: 30, label: '30 Documents' },
        ],
    },
    wrapLinesPreference: {},
    stripedRowsPreference: {},
    contentDensityPreference: {},
    stickyColumnsPreference: {
        firstColumns: {
            title: 'Stick first column(s)',
            description: 'Keep the first column(s) visible while horizontally scrolling the table content.',
            options: [
                { label: 'None', value: 0 },
                { label: 'First column', value: 1 },
            ],
        },
        lastColumns: {
            title: 'Stick last column',
            description: 'Keep the last column visible while horizontally scrolling the table content.',
            options: [
                { label: 'None', value: 0 },
                { label: 'Last column', value: 1 },
            ],
        },
    },
    contentDisplayPreference: {
        options: columnDefs.map((c) => {
            return {
                id: c.id,
                label: c.header,
            };
        }),
    },
};

export const DEFAULT_PREFERENCES: CollectionPreferencesProps.Preferences = {
    pageSize: 20,
    wrapLines: false,
    stripedRows: true,
    visibleContent: ['fileName', 'status', 'analysisType', 'uploadTime', 'fileSize'],
    contentDisplay: [
        {
            id: 'fileName',
            visible: true,
        },
        {
            id: 'status',
            visible: true,
        },
        {
            id: 'analysisType',
            visible: true,
        },
        {
            id: 'uploadTime',
            visible: true,
        },
        {
            id: 'fileSize',
            visible: true,
        },
        {
            id: 'completionTime',
            visible: false,
        },
        {
            id: 'duration',
            visible: false,
        },
        {
            id: 'errorMessage',
            visible: false,
        },
    ],
    stickyColumns: {
        first: 0,
        last: 0,
    },
};
