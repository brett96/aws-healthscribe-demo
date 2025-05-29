// Configuration utility for handling environment variables safely

export interface AppConfig {
    openmrs: {
        baseUrl: string;
        username?: string;
        password?: string;
    };
    features: {
        enableOpenMRSIntegration: boolean;
    };
}

// Default configuration
const defaultConfig: AppConfig = {
    openmrs: {
        baseUrl: '/openmrs',
        username: 'admin',
        password: 'Admin123',
    },
    features: {
        enableOpenMRSIntegration: true,
    },
};

// Add interface for window environment variables
interface WindowWithEnv extends Window {
    __ENV__?: Record<string, string>;
}

// Get configuration value safely
function getEnvVar(key: string, defaultValue: string = ''): string {
    try {
        // Check if we're in a browser environment with injected env vars
        if (typeof window !== 'undefined' && (window as WindowWithEnv).__ENV__) {
            return (window as WindowWithEnv).__ENV__?.[key] || defaultValue;
        }

        // Check if process.env is available (build time)
        if (typeof process !== 'undefined' && process.env) {
            return process.env[key] || defaultValue;
        }

        return defaultValue;
    } catch (error) {
        console.warn(`Failed to get environment variable ${key}, using default:`, defaultValue);
        return defaultValue;
    }
}

// Load configuration
function loadConfig(): AppConfig {
    return {
        openmrs: {
            baseUrl: getEnvVar('REACT_APP_OPENMRS_BASE_URL', defaultConfig.openmrs.baseUrl),
            username: getEnvVar('REACT_APP_OPENMRS_USERNAME', defaultConfig.openmrs.username),
            password: getEnvVar('REACT_APP_OPENMRS_PASSWORD', defaultConfig.openmrs.password),
        },
        features: {
            enableOpenMRSIntegration: getEnvVar('REACT_APP_ENABLE_OPENMRS_INTEGRATION', 'true') === 'true',
        },
    };
}

// Current runtime configuration
let runtimeConfig: AppConfig = loadConfig();

// Export the current config
export const appConfig = runtimeConfig;

/**
 * Update the runtime configuration
 * This allows for dynamic configuration updates
 * @param newConfig Partial configuration to update
 */
export function updateConfig(newConfig: Partial<AppConfig>) {
    runtimeConfig = {
        ...runtimeConfig,
        ...newConfig,
        openmrs: {
            ...runtimeConfig.openmrs,
            ...(newConfig.openmrs || {}),
        },
        features: {
            ...runtimeConfig.features,
            ...(newConfig.features || {}),
        },
    };
    console.log('Updated OpenMRS configuration:', runtimeConfig);
}

/**
 * Test OpenMRS connectivity with different base URLs
 * Helps determine the correct configuration
 */
export async function testOpenMRSConnectivity(): Promise<
    { url: string; status: 'success' | 'error'; error?: string }[]
> {
    const testUrls = [
        '/openmrs', // Proxy path (should work with Vite proxy)
        'http://localhost/openmrs',
        'http://localhost:8080/openmrs',
        'http://127.0.0.1/openmrs',
        'http://127.0.0.1:8080/openmrs',
    ];

    const results = [];

    for (const baseUrl of testUrls) {
        try {
            const response = await fetch(`${baseUrl}/ws/rest/v1/session`, {
                method: 'GET',
                headers: {
                    Authorization: `Basic ${btoa(`${runtimeConfig.openmrs.username}:${runtimeConfig.openmrs.password}`)}`,
                    'Content-Type': 'application/json',
                },
            });

            if (response.ok) {
                results.push({ url: baseUrl, status: 'success' as const });
            } else {
                results.push({
                    url: baseUrl,
                    status: 'error' as const,
                    error: `HTTP ${response.status} ${response.statusText}`,
                });
            }
        } catch (error) {
            results.push({
                url: baseUrl,
                status: 'error' as const,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    return results;
}

/**
 * Get the best working OpenMRS URL
 * Returns null if none work
 */
export async function findWorkingOpenMRSUrl(): Promise<string | null> {
    const results = await testOpenMRSConnectivity();
    const working = results.find((result) => result.status === 'success');
    return working ? working.url : null;
}

/**
 * Auto-configure OpenMRS based on connectivity test
 */
export async function autoConfigureOpenMRS(): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
        const workingUrl = await findWorkingOpenMRSUrl();

        if (workingUrl) {
            updateConfig({
                openmrs: {
                    baseUrl: workingUrl,
                },
            });
            return { success: true, url: workingUrl };
        } else {
            return {
                success: false,
                error: 'No working OpenMRS URL found. Please check if OpenMRS is running.',
            };
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error during auto-configuration',
        };
    }
}
