// thecircle-frontend/src/login.service.ts

export interface LoginResponse {
    token?: string;
    message?: string;
    [key: string]: any;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Login failed');
        }
        return data;
    } catch (error: any) {
        return { message: error.message || 'Network error' };
    }
}