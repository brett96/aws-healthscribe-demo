// OpenMRS API integration utilities
import { appConfig } from '@/utils/config';

interface OpenMRSConfig {
    baseUrl: string;
    username?: string;
    password?: string;
    sessionId?: string;
    csrfToken?: string;
}

interface IdentifierType {
    uuid: string;
    name: string;
    checkDigit: boolean;
    retired: boolean;
}

// Default configuration - can be updated at runtime
let openMRSConfig: OpenMRSConfig = {
    baseUrl: appConfig.openmrs.baseUrl,
    username: appConfig.openmrs.username,
    password: appConfig.openmrs.password,
};

/**
 * Update OpenMRS configuration
 */
export function updateOpenMRSConfig(config: Partial<OpenMRSConfig>) {
    openMRSConfig = { ...openMRSConfig, ...config };
}

/**
 * Initialize OpenMRS configuration from environment variables
 * Call this function to load environment-specific settings
 */
export function initializeOpenMRSConfig() {
    // For now, we'll use the default configuration
    // In a real deployment, you would set these values through your deployment process
    // or use a configuration service
    // Example of how to override for different environments:
    // if (window.location.hostname === 'your-production-domain.com') {
    //     updateOpenMRSConfig({
    //         baseUrl: 'https://your-openmrs-server.com/openmrs'
    //     });
    // }
}

/**
 * Get OpenMRS configuration
 */
export function getOpenMRSConfig(): OpenMRSConfig {
    return openMRSConfig;
}

/**
 * Get basic auth headers for OpenMRS
 */
function getOpenMRSHeaders(): HeadersInit {
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };

    if (openMRSConfig.username && openMRSConfig.password) {
        headers['Authorization'] = `Basic ${btoa(`${openMRSConfig.username}:${openMRSConfig.password}`)}`;
    }

    // Include CSRF token if available
    if (openMRSConfig.csrfToken) {
        headers['X-OpenMRS-CSRFToken'] = openMRSConfig.csrfToken;
    }

    return headers;
}

/**
 * Establish session and get CSRF token from OpenMRS
 */
async function establishSession(): Promise<boolean> {
    try {
        const response = await fetch(`${openMRSConfig.baseUrl}/ws/rest/v1/session`, {
            method: 'GET',
            headers: {
                Authorization: `Basic ${btoa(`${openMRSConfig.username}:${openMRSConfig.password}`)}`,
                'Content-Type': 'application/json',
            },
            credentials: 'include', // Include cookies for session management
        });

        if (response.ok) {
            const sessionData = await response.json();
            openMRSConfig.sessionId = sessionData.sessionId;

            // Extract CSRF token from cookies or headers
            const csrfTokenFromHeader = response.headers.get('X-OpenMRS-CSRFToken');
            if (csrfTokenFromHeader) {
                openMRSConfig.csrfToken = csrfTokenFromHeader;
            } else {
                // Try to get CSRF token from session data
                openMRSConfig.csrfToken = sessionData.csrfToken;
            }

            console.log('OpenMRS session established:', {
                sessionId: openMRSConfig.sessionId,
                hasCsrfToken: !!openMRSConfig.csrfToken,
            });

            return true;
        }
        return false;
    } catch (error) {
        console.error('Failed to establish OpenMRS session:', error);
        return false;
    }
}

/**
 * Authenticate with OpenMRS using basic auth and establish session
 */
export async function authenticateWithOpenMRS(username: string, password: string): Promise<boolean> {
    openMRSConfig.username = username;
    openMRSConfig.password = password;
    return await establishSession();
}

/**
 * Test OpenMRS connection with optional auto-session establishment
 */
export async function testOpenMRSConnection(): Promise<boolean> {
    try {
        const response = await fetch(`${openMRSConfig.baseUrl}/ws/rest/v1/session`, {
            method: 'GET',
            headers: getOpenMRSHeaders(),
            credentials: 'include',
        });

        if (response.ok) {
            // If we don't have a session yet, establish one
            if (!openMRSConfig.sessionId || !openMRSConfig.csrfToken) {
                await establishSession();
            }
            return true;
        }
        return false;
    } catch (error) {
        console.error('OpenMRS connection test failed:', error);
        return false;
    }
}

/**
 * Generic OpenMRS API call wrapper with CSRF handling
 */
export async function callOpenMRSAPI<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${openMRSConfig.baseUrl}/ws/rest/v1/${endpoint}`;

    // Ensure we have a session for write operations
    if (
        (options.method === 'POST' || options.method === 'PUT' || options.method === 'DELETE') &&
        (!openMRSConfig.sessionId || !openMRSConfig.csrfToken)
    ) {
        console.log('Establishing session for write operation...');
        const sessionEstablished = await establishSession();
        if (!sessionEstablished) {
            throw new Error('Failed to establish OpenMRS session. Please check your credentials.');
        }
    }

    const headers = {
        ...getOpenMRSHeaders(),
        ...options.headers,
    };

    const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // Include cookies for session management
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenMRS API Error:', {
            status: response.status,
            statusText: response.statusText,
            url,
            method: options.method || 'GET',
            response: errorText,
        });

        // If we get a 401 or 403, try to re-establish session
        if (response.status === 401 || response.status === 403) {
            console.log('Authentication error, attempting to re-establish session...');
            const sessionEstablished = await establishSession();
            if (sessionEstablished) {
                // Retry the request with new session
                const retryHeaders = {
                    ...getOpenMRSHeaders(),
                    ...options.headers,
                };

                const retryResponse = await fetch(url, {
                    ...options,
                    headers: retryHeaders,
                    credentials: 'include',
                });

                if (retryResponse.ok) {
                    return retryResponse.json();
                }
            }
        }

        throw new Error(`OpenMRS API call failed: ${response.status} ${response.statusText}. ${errorText}`);
    }

    return response.json();
}

/**
 * Search for patients in OpenMRS
 */
export async function searchPatients(query: string) {
    return callOpenMRSAPI(`patient?q=${encodeURIComponent(query)}&v=default`);
}

/**
 * Get patient by UUID
 */
export async function getPatient(patientUuid: string) {
    return callOpenMRSAPI(`patient/${patientUuid}?v=full`);
}

/**
 * Get available patient identifier types from OpenMRS
 */
export async function getPatientIdentifierTypes() {
    return callOpenMRSAPI('patientidentifiertype?v=default');
}

/**
 * Find a suitable identifier type that doesn't require check digits
 */
export async function findSuitableIdentifierType(): Promise<string> {
    try {
        const response = (await getPatientIdentifierTypes()) as { results: IdentifierType[] };
        const identifierTypes = response.results || [];

        // Look for identifier types that don't require check digits
        const suitable = identifierTypes.find(
            (type) =>
                !type.checkDigit &&
                !type.retired &&
                type.name &&
                (type.name.toLowerCase().includes('id') ||
                    type.name.toLowerCase().includes('number') ||
                    type.name.toLowerCase().includes('patient'))
        );

        if (suitable) {
            console.log('Found suitable identifier type:', suitable.name, suitable.uuid);
            return suitable.uuid;
        }

        // Fallback: find any non-retired type without check digits
        const fallback = identifierTypes.find((type) => !type.checkDigit && !type.retired);
        if (fallback) {
            console.log('Using fallback identifier type:', fallback.name, fallback.uuid);
            return fallback.uuid;
        }

        // If still no luck, use the default but log it
        console.warn('No identifier type without check digits found, using default');
        return '05a29f94-c0ed-11e2-94be-8c13b969e334';
    } catch (error) {
        console.error('Error fetching identifier types:', error);
        return '05a29f94-c0ed-11e2-94be-8c13b969e334'; // Default fallback
    }
}

/**
 * Generate a simple numeric patient identifier that's less likely to fail validation
 */
export function generateNumericPatientId(): string {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 99)
        .toString()
        .padStart(2, '0');
    // Use shorter identifiers - just last 5 digits of timestamp + 2 random digits
    return timestamp.slice(-5) + random; // e.g., "1234567"
}

/**
 * Create a new patient with proper session handling
 */
export async function createPatient(patientData: Record<string, unknown>) {
    console.log('Creating patient with data:', patientData);

    // Ensure we have a valid session before creating patient
    if (!openMRSConfig.sessionId || !openMRSConfig.csrfToken) {
        console.log('No active session, establishing one...');
        const sessionEstablished = await establishSession();
        if (!sessionEstablished) {
            throw new Error('Failed to establish OpenMRS session. Please check your connection and credentials.');
        }
    }

    return callOpenMRSAPI('patient', {
        method: 'POST',
        body: JSON.stringify(patientData),
    });
}

/**
 * Get encounters for a patient
 */
export async function getPatientEncounters(patientUuid: string) {
    return callOpenMRSAPI(`encounter?patient=${patientUuid}&v=default`);
}

/**
 * Create a new encounter
 */
export async function createEncounter(encounterData: Record<string, unknown>) {
    return callOpenMRSAPI('encounter', {
        method: 'POST',
        body: JSON.stringify(encounterData),
    });
}

/**
 * Get observations for an encounter
 */
export async function getObservations(encounterUuid: string) {
    return callOpenMRSAPI(`obs?encounter=${encounterUuid}&v=default`);
}

/**
 * Generate a simple patient identifier
 * This creates a basic sequential ID that's less likely to trigger check digit validation
 */
export function generateSimplePatientId(): string {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, '0');
    return `PAT${timestamp.slice(-6)}${random}`; // e.g., PAT123456789
}

/**
 * Create observation
 */
export async function createObservation(obsData: Record<string, unknown>) {
    return callOpenMRSAPI('obs', {
        method: 'POST',
        body: JSON.stringify(obsData),
    });
}
