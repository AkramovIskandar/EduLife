(function initEduApiConfig() {
    const explicitBase = String(window.EDU_API_BASE_URL || '').trim();
    const localHosts = new Set(['127.0.0.1', 'localhost']);
    const localPorts = ['3002', '3000', '3001'];

    function getCandidateBases() {
        if (explicitBase) {
            return [explicitBase.replace(/\/+$/, '')];
        }

        const { hostname, port, origin } = window.location;
        if (!localHosts.has(hostname)) {
            return [''];
        }

        if (localPorts.includes(port)) {
            return [origin.replace(/\/+$/, '')];
        }

        return localPorts.map((candidatePort) => `http://localhost:${candidatePort}`);
    }

    window.EDU_API_BASE_URL = explicitBase;
    window.EDU_API_BASE_CANDIDATES = getCandidateBases();

    window.eduBuildApiUrl = function eduBuildApiUrl(endpoint, base = '') {
        if (!base) return endpoint;
        return `${String(base).replace(/\/+$/, '')}${endpoint}`;
    };

    window.eduFetchApi = async function eduFetchApi(endpoint, options = {}) {
        const candidates = Array.isArray(window.EDU_API_BASE_CANDIDATES) && window.EDU_API_BASE_CANDIDATES.length
            ? window.EDU_API_BASE_CANDIDATES
            : [''];

        let lastError = null;

        for (const base of candidates) {
            const url = window.eduBuildApiUrl(endpoint, base);
            try {
                const response = await fetch(url, options);

                // Static servers often return 404 for /api/*, so try the next candidate.
                if (response.status === 404 && candidates.length > 1) {
                    lastError = new Error(`API not found at ${url}`);
                    continue;
                }

                return response;
            } catch (error) {
                lastError = error;
            }
        }

        throw lastError || new Error('API request failed.');
    };
})();
