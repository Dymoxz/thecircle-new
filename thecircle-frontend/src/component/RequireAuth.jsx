import { Navigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

const RequireAuth = ({ children }) => {
  const token = localStorage.getItem('jwt_token');

  if (!token) return <Navigate to="/login" replace />;

  try {
    const { exp } = jwtDecode(token);
    if (Date.now() >= exp * 1000) {
      console.log("expired");
      // Token expired
      return <Navigate to="/login" replace />;
    }
  } catch (e) {
    console.log("invalid token");
    // Invalid token format
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default RequireAuth;
