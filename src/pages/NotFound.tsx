import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, Dumbbell } from 'lucide-react';

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error('404 — route not found:', location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 text-center px-6 max-w-lg">
        {/* Icon */}
        <div className="flex justify-center mb-8">
          <div className="w-24 h-24 rounded-3xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <Dumbbell className="w-12 h-12 text-green-400" />
          </div>
        </div>

        {/* 404 */}
        <h1 className="text-8xl md:text-9xl font-black font-heading mb-4 bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent leading-none">
          404
        </h1>

        <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 font-heading">
          Page Not Found
        </h2>
        <p className="text-gray-400 font-body mb-10 leading-relaxed">
          Looks like this page skipped leg day and went missing.<br />
          Let's get you back on track.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => navigate('/')}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-green-400 to-green-600 text-black px-7 py-3 rounded-xl font-bold font-heading hover:from-green-300 hover:to-green-500 transition-all duration-300 hover:scale-105 active:scale-95"
          >
            <Home className="w-4 h-4" />
            Back to Home
          </button>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center gap-2 border border-gray-700 text-gray-300 hover:border-green-400 hover:text-green-400 px-7 py-3 rounded-xl font-semibold font-heading transition-all duration-300 hover:scale-105 active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
