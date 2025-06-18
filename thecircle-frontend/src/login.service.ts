// thecircle-frontend/src/login.service.ts

export type LoginResponse = {
    _id?: string;
    email?: string;
    token?: string;
    message?: string;
};

export async function login(email: string, password: string): Promise<LoginResponse> {
    try {
        // Changed endpoint to explicit https://localhost:3002/api/auth/login
        const response = await fetch('https://localhost:3002/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
            credentials: 'omit'
        });

        const text = await response.text();
        const data = text ? JSON.parse(text) : {};
        if (!response.ok) {
            return { message: data.message || 'Login failed' };
        }
        return data;
    } catch (error) {
        return { message: (error instanceof Error ? error.message : 'Network error') };
    }
}