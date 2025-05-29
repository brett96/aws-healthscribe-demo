// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { CollectionPreferencesProps } from '@cloudscape-design/components';

import { columnDefs } from './patientsColumnDefs';

export const collectionPreferencesProps = {
    preferences: {
        pageSize: 10,
        visibleContent: ['name', 'identifier', 'gender', 'age'],
    },
    pageSizePreference: {
        title: 'Select page size',
        options: [
            { value: 10, label: '10 Patients' },
            { value: 20, label: '20 Patients' },
            { value: 30, label: '30 Patients' },
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
    visibleContent: ['name', 'identifier', 'gender', 'age', 'birthdate'],
    contentDisplay: [
        {
            id: 'name',
            visible: true,
        },
        {
            id: 'identifier',
            visible: true,
        },
        {
            id: 'gender',
            visible: true,
        },
        {
            id: 'age',
            visible: true,
        },
        {
            id: 'birthdate',
            visible: true,
        },
        {
            id: 'address',
            visible: false,
        },
    ],
    stickyColumns: {
        first: 0,
        last: 0,
    },
};
