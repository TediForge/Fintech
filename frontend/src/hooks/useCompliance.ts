import config from '@config/app';
import { apiConfig } from '@config/api';

export const checkUserCompliance = async (sessionToken: string | null | undefined) => {
	if (!sessionToken) {
		return {
			success: false,
			complianceStatus: 'failed',
			missingFields: [],
			message: 'A valid session token is required to perform a compliance check',
			status: 401,
			hasValidResponse: false,
			error: null,
		};
	}

	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 10000);
		const response = await fetch(`${apiConfig.baseUrl}/v1/user/compliance/checkCompliance.php`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ sessionToken }),
			signal: controller.signal,
		});
		clearTimeout(timeoutId);

		const result = await response.json().catch(() => ({}));
		return {
			success: result?.success === true,
			complianceStatus: result?.complianceStatus,
			missingFields: Array.isArray(result?.missingFields) ? result.missingFields : [],
			completedFields: Array.isArray(result?.completedFields) ? result.completedFields : [],
			allFields: Array.isArray(result?.allFields) ? result.allFields : [],
			message: result?.message || '',
			status: response.status,
			hasValidResponse: true,
			error: null,
		};
	} catch (error) {
		console.log('[ComplianceCheck] network error:', error);
		return {
			success: false,
			complianceStatus: 'failed',
			missingFields: [],
			message: 'Compliance check could not be completed.',
			status: 500,
			hasValidResponse: false,
			error,
		};
	}
};
