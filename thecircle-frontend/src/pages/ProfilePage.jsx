import React, {useEffect, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {ArrowLeft, Calendar, Heart, Mail, User, Users} from 'lucide-react';
import {jwtDecode} from 'jwt-decode';

const API_BASE_URL = "https://localhost:3001/api";

if (!API_BASE_URL) {
    console.error('VITE_API_BASE_URL is not defined in .env file');
}

const ProfilePage = () => {
  const { userName: paramUserName } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribers, setSubscribers] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [viewedProfileName, setViewedProfileName] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  

    // Effect to determine currentUser from JWT and which profile to view
    useEffect(() => {
        const token = localStorage.getItem('jwt_token');
        if (!token) {
            navigate('/login');
            return;
        }

    try {
      const decodedToken = jwtDecode(token);
      const loggedInUserName = decodedToken.userName;
      setCurrentUser(loggedInUserName);

      if (paramUserName) {
        setViewedProfileName(paramUserName);
      } else {
        setViewedProfileName(loggedInUserName);
      }
    } catch (e) {
      console.error("Failed to decode token or token invalid:", e);
      localStorage.removeItem('jwt_token');
      navigate('/login');
    }
  }, [paramUserName, navigate]);

  // Effect to fetch profile data
  useEffect(() => {
    const fetchProfileData = async () => {
      if (!viewedProfileName || !currentUser) {
        setLoading(false);
        console.warn('Profile ID or current user ID not available yet. Skipping fetch.');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem('jwt_token');
        if (!token) {
          throw new Error('Authentication token not found. Please log in.');
        }

        const headers = { 'Authorization': `Bearer ${token}` };

        const [profileRes, subsRes, subscrRes, subCheckRes] = await Promise.all([
          fetch(`${API_BASE_URL}/profile/${viewedProfileName}`, { headers }),
          fetch(`${API_BASE_URL}/profile/subscribers/${viewedProfileName}`, { headers }),
          fetch(`${API_BASE_URL}/profile/subscriptions/${viewedProfileName}`, { headers }),
          currentUser !== viewedProfileName ? fetch(`${API_BASE_URL}/profile/is-subscribed/${currentUser}/${viewedProfileName}`, { headers }) : Promise.resolve({ ok: true, json: () => ({ exists: false }) }),
          new Promise(resolve => setTimeout(resolve, 500)) // 500ms minimum delay
        ]);

        // Process profile data
        if (!profileRes.ok) {
          const errorData = await profileRes.json();
          throw new Error(errorData.message || 'Profile not found');
        }
        const profileData = await profileRes.json();
        setProfile(profileData);

        // Process subscription status
        if (currentUser !== viewedProfileName) {
          if (!subCheckRes.ok) throw new Error('Subscription check failed');
          const subData = await subCheckRes.json();
          setIsSubscribed(subData?.exists || false);
        } else {
          setIsSubscribed(false);
        }

        // Process subscribers
        if (!subsRes.ok) throw new Error('Failed to fetch subscribers');
        const subsData = await subsRes.json();
        setSubscribers(Array.isArray(subsData) ? subsData : []);

        // Process subscriptions
        if (!subscrRes.ok) throw new Error('Failed to fetch subscriptions');
        const subscrData = await subscrRes.json();
        setSubscriptions(Array.isArray(subscrData) ? subscrData : []);

      } catch (err) {
        setError(err.message);
        console.error('Fetch error:', err);
        if (err.message.includes('Authentication token')) {
          navigate('/login');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [viewedProfileName, currentUser, navigate]);

  const handleSubscribe = async () => {
    setActionLoading(true);
    try {
      const token = localStorage.getItem('jwt_token');
      if (!token) { navigate('/login'); return; }

      const res = await fetch(`${API_BASE_URL}/profile/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          streamerName: viewedProfileName,
        }),
      });

      if (res.ok) {
        setIsSubscribed(true);
        setProfile(prev => ({
          ...prev,
          subscriberCount: (prev?.subscriberCount || 0) + 1,
        }));
        
        // Add the new subscription to the subscriptions list
        const newSubscription = {
          _id: Date.now().toString(), // temporary ID
          streamer: {
            _id: viewedProfileName,
            userName: profile?.userName || 'New Sub'
          },
          createdAt: new Date().toISOString()
        };
        
        setSubscriptions(prev => [...prev, newSubscription]);

        // If viewing your own profile, add to subscribers list
        if (currentUser === viewedProfileName) {
          const newSubscriber = {
            _id: Date.now().toString(), // temporary ID
            subscriber: {
              _id: currentUser,
              userName: "Current User" // You might want to get this from profile data
            },
            createdAt: new Date().toISOString()
          };
          setSubscribers(prev => [...prev, newSubscriber]);
        }
      } else {
        const errorData = await res.json();
        console.error('Subscribe error:', errorData.message || 'Failed to subscribe');
        setError(errorData.message || 'Failed to subscribe');
      }
    } catch (err) {
      console.error('Subscribe network error:', err);
      setError('Network error during subscription.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    setActionLoading(true);
    try {
      const token = localStorage.getItem('jwt_token');
      if (!token) { navigate('/login'); return; }

      const res = await fetch(`${API_BASE_URL}/profile/unsubscribe`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          subscriberName: currentUser,
          streamerName: viewedProfileName,
        }),
      });

      if (res.ok) {
        setIsSubscribed(false);
        setProfile(prev => ({
          ...prev,
          subscriberCount: (prev?.subscriberCount || 0) - 1,
        }));
        
        // Remove the subscription from the subscriptions list
        setSubscriptions(prev => 
          prev.filter(sub => sub.streamer?._id !== viewedProfileName)
        );

        // If viewing your own profile, remove from subscribers list
        if (currentUser === viewedProfileName) {
          setSubscribers(prev => 
            prev.filter(sub => sub.subscriber?._id !== currentUser)
          );
        }
      } else {
        const errorData = await res.json();
        console.error('Unsubscribe error:', errorData.message || 'Failed to unsubscribe');
        setError(errorData.message || 'Failed to unsubscribe');
      }
    } catch (err) {
      console.error('Unsubscribe network error:', err);
      setError('Network error during unsubscription.');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const isMyProfile = currentUser && viewedProfileName && currentUser === viewedProfileName;
  const showSubscribeButton = currentUser && viewedProfileName && currentUser !== viewedProfileName;

    if (loading) return (
        <div
            className="flex items-center justify-center h-screen bg-gradient-to-br from-[#7a1a1a] via-[#a83246] to-[#2d0a14] text-white font-oswald">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
        </div>
    );

    if (error) return (
        <div
            className="flex items-center justify-center h-screen bg-gradient-to-br from-[#7a1a1a] via-[#a83246] to-[#2d0a14] text-white font-oswald">
            <div className="text-center p-6 bg-white/80 rounded-lg max-w-md shadow-lg shadow-black/30">
                <h2 className="text-xl font-semibold text-[#a83246] mb-2">Error</h2>
                <p className="text-gray-800">{error}</p>
                <button
                    onClick={() => navigate('/')}
                    className="mt-4 px-4 py-2 bg-[#a83246] text-white rounded-full hover:bg-[#c04d65] transition-colors shadow-lg shadow-[#a83246]/40"
                >
                    Go Home
                </button>
            </div>
        </div>
    );

    return (
        <div
            className="min-h-screen w-screen bg-gradient-to-br from-[#7a1a1a] via-[#a83246] to-[#2d0a14] text-white flex items-center justify-center p-4 relative overflow-hidden font-oswald">
            {/* Back to Home Button - fixed top left, outside panels */}
            <button
                onClick={() => navigate('/')}
                className="fixed top-6 left-6 z-20 p-2 rounded-full bg-white/20 text-[#7a1a1a] hover:bg-white/30 transition-colors focus:outline-none focus:ring-2 focus:ring-[#a83246] shadow-lg"
                style={{backdropFilter: 'blur(2px)'}}
            >
                <ArrowLeft className="w-7 h-7"/>
            </button>
            <div className="relative z-10 w-full max-w-5xl flex flex-col gap-6 items-center justify-center">
                {/* Profile Header Panel - closer to next panel */}
                <div
                    className="bg-white/80 border border-white/10 rounded-3xl p-6 shadow-xl shadow-black/30 w-full flex flex-col items-center transition-all duration-300">
                    <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8 w-full">
                        <div
                            className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-white/20 border-2 border-[#a83246] flex items-center justify-center shadow-lg">
                          <span className="text-3xl md:text-4xl font-bold text-[#7a1a1a]">
                            {profile?.userName?.charAt(0).toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div className="flex-1 text-[#7a1a1a] flex flex-col items-center md:items-start">
                            <h1 className="text-2xl md:text-3xl font-bold mb-1">{profile?.userName}</h1>
                            <div className="flex flex-wrap gap-3 mb-2">
                                <div className="flex items-center">
                                    <Users className="w-5 h-5 mr-2 text-[#a83246]"/>
                                    <span>{profile?.subscriberCount || 0} subscribers</span>
                                </div>
                                {profile?.isLive && (
                                    <div
                                        className="flex items-center bg-red-600 px-3 py-1 rounded-full text-sm font-semibold text-white">
                                        <div className="w-2 h-2 bg-white rounded-full animate-ping mr-2"></div>
                                        <span>Live Now</span>
                                    </div>
                                )}
                            </div>
                            {showSubscribeButton && (
                                <button
                                    onClick={isSubscribed ? handleUnsubscribe : handleSubscribe}
                                    className={`flex items-center px-6 py-2 rounded-full font-semibold transition-colors shadow-md mt-2 ${isSubscribed
                                        ? 'bg-white/10 border border-white/20 text-[#7a1a1a] hover:bg-white/20'
                                        : 'bg-[#a83246] text-white hover:bg-[#c04d65] shadow-lg shadow-[#a83246]/40'} ${actionLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    disabled={actionLoading}
                                >
                                    {actionLoading ? (
                                        <div
                                            className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
                                    ) : (
                                        <Heart fill={isSubscribed ? "#a83246" : "none"} className="w-5 h-5 mr-2"/>
                                    )}
                                    {actionLoading ? (isSubscribed ? 'Unsubscribing...' : 'Subscribing...') : (isSubscribed ? 'Subscribed' : 'Subscribe')}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                {/* Main Content Panels - closer together */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                    {/* Main Profile Info */}
                    <div
                        className="light-bg md:col-span-2 bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl shadow-black/30 p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center">
                            <User className="w-5 h-5 mr-2 text-[#a83246]"/>
                            About
                        </h2>
                        <div className="space-y-3 text-gray-800">
                            <div>
                                <h3 className="text-sm font-medium text-neutral-600">Username</h3>
                                <p className="mt-1 text-lg font-semibold">{profile?.userName}</p>
                            </div>
                            <div>
                                <h3 className="text-sm font-medium text-neutral-600">Email</h3>
                                <p className="mt-1 flex items-center">
                                    <Mail className="w-4 h-4 mr-2 text-neutral-500"/>
                                    {profile?.email}
                                </p>
                            </div>
                            <div>
                                <h3 className="text-sm font-medium text-neutral-600">Earned Satoshis</h3>
                                <p className="mt-1 text-lg font-semibold flex items-center">
                                    <span className="text-yellow-600 mr-1">₿</span>
                                    {profile?.satoshis || 0}
                                </p>
                            </div>
                            {profile?.birthdate && (
                                <div>
                                    <h3 className="text-sm font-medium text-neutral-600">Birthdate</h3>
                                    <p className="mt-1 flex items-center">
                                        <Calendar className="w-4 h-4 mr-2 text-neutral-500"/>
                                        {formatDate(profile.birthdate)}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                    {/* Sidebar - min-h to match About panel */}
                    <div className="space-y-4 flex flex-col h-full" style={{minHeight: '100%'}}>
                        <div className="flex flex-col h-full" style={{minHeight: '100%'}}>
                            <div className="flex flex-col flex-1 min-h-0" style={{minHeight: '100%'}}>
                                <div
                                    className="light-bg bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl shadow-black/30 p-6 flex-1">
                                    <h3 className="text-xl font-bold text-gray-900 mb-3 flex items-center">
                                        <Users className="w-5 h-5 mr-2 text-[#a83246]"/>
                                        Subscribers
                                    </h3>
                                    {subscribers.length > 0 ? (
                                        <ul className="space-y-2">
                                            {subscribers.slice(0, 5).map(sub => (
                                                sub?.user && (
                                                    <li
                                                        key={sub._id || sub.user._id}
                                                        className="flex items-center p-2 rounded-3xl hover:bg-[#f3ece8] transition-colors cursor-pointer"
                                                        onClick={() => navigate(`/profile/${sub.user.userName}`)}
                                                    >
                                                        <div
                                                            className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center mr-3 flex-shrink-0 text-white text-sm font-bold">
                                                            {sub.user.userName?.charAt(0).toUpperCase() || 'U'}
                                                        </div>
                                                        <span
                                                            className="font-semibold text-gray-800 flex-grow truncate">{sub.user.userName}</span>
                                                    </li>
                                                )
                                            ))}
                                            {subscribers.length > 5 && (
                                                <p className="text-sm text-gray-600 mt-2">
                                                    +{subscribers.length - 5} more
                                                </p>
                                            )}
                                        </ul>
                                    ) : (
                                        <p className="text-gray-600 text-sm">No subscribers yet.</p>
                                    )}
                                </div>
                                <div
                                    className="light-bg bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl shadow-black/30 p-6 flex-1 mt-4">
                                    <h3 className="text-xl font-bold text-gray-900 mb-3 flex items-center">
                                        <Heart className="w-5 h-5 mr-2 text-[#a83246]"/>
                                        Subscriptions
                                    </h3>
                                    {subscriptions.length > 0 ? (
                                        <ul className="space-y-2">
                                            {subscriptions.map(sub => (
                                                sub?.user && (
                                                    <li
                                                        key={sub._id || sub.user._id}
                                                        className="flex items-center p-2 rounded-3xl hover:bg-[#f3ece8] transition-colors cursor-pointer"
                                                        onClick={() => navigate(`/profile/${sub.user.userName}`)}
                                                    >
                                                        <div
                                                            className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center mr-3 flex-shrink-0 text-white text-sm font-bold">
                                                            {sub.user.userName?.charAt(0).toUpperCase() || 'U'}
                                                        </div>
                                                        <span
                                                            className="font-semibold text-gray-800 flex-grow truncate">{sub.user.userName}</span>
                                                    </li>
                                                )
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-gray-600 text-sm">Not subscribed to anyone.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;
