import React from 'react';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { isAuthorizedUser, storeUser } from '../services/authService';

interface LoginProps {
  onLoginSuccess: (user: { email: string; name: string; picture: string }) => void;
}

interface GoogleJwtPayload {
  email: string;
  name: string;
  picture: string;
  sub: string;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [error, setError] = React.useState<string | null>(null);

  const handleSuccess = (credentialResponse: CredentialResponse) => {
    try {
      if (!credentialResponse.credential) {
        setError('Failed to receive credentials');
        return;
      }

      // Decode JWT to get user info
      const decoded = jwtDecode<GoogleJwtPayload>(credentialResponse.credential);
      const { email, name, picture } = decoded;

      // Check if user is authorized
      if (!isAuthorizedUser(email)) {
        setError(`Access denied. Only users from @milovanoviclaw.com domain or authorized emails can access this application.`);
        return;
      }

      // Store user and notify parent
      const user = { email, name, picture };
      storeUser(user);
      onLoginSuccess(user);
    } catch (err) {
      console.error('Login error:', err);
      setError('Failed to process login');
    }
  };

  const handleError = () => {
    setError('Login failed. Please try again.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-profBlue-50 to-slate-100">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-profBlue-900 mb-2">
            LegalTranslator
          </h1>
          <p className="text-slate-600">
            Professional Legal Document Translation
          </p>
        </div>

        <div className="mb-6">
          <div className="bg-profBlue-50 border border-profBlue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-profBlue-800 font-medium mb-2">
              Authorized Access Only
            </p>
            <p className="text-xs text-profBlue-700">
              This application is restricted to:
            </p>
            <ul className="text-xs text-profBlue-700 mt-2 ml-4 list-disc">
              <li>@milovanoviclaw.com domain</li>
              <li>Authorized email addresses</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-center mb-4">
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={handleError}
            useOneTap
            auto_select
          />
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-slate-200">
          <p className="text-xs text-slate-500 text-center">
            By signing in, you agree to use this application in accordance with professional legal standards.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
