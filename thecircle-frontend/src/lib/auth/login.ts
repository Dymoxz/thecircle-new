import { IUser } from '';

export class LoginService {
    private apiUrl = 'http://localhost:3001/api/auth/login';

    async login(email: string, password: string): Promise<IUser | undefined> {
        try {
            const response = await fetch(`${this.apiUrl}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ emailAddress: email, password }),
            });

            const result = await response.json();

            if (result?.response?.error) {
                throw new Error(result.response.message || 'Login error');
            }

            const user = result.results;

            return user;
        } catch (error: any) {
            console.error('Login error:', error);

            if (error.name === 'TypeError') {
                alert("❌ Can't connect to the server!");
            } else {
                alert(error.message || 'Unknown login error');
            }

            return undefined;
        }
    }

}
