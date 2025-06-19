import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Mail, Calendar, Users, Heart, MessageSquare, Settings as SettingsIcon } from 'lucide-react'; // Import SettingsIcon
import { jwtDecode } from 'jwt-decode';

const API_BASE_URL = "https://localhost:3001/api";

if (!API_BASE_URL) {
  console.error('VITE_API_BASE_URL is not defined in .env file');
}

const ProfilePage = () => {
  const { userId: paramUserId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribers, setSubscribers] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);;
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [viewedProfileId, setViewedProfileId] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const decodedToken = jwtDecode(token);
      console.log(decodedToken);
      const loggedInUserId = decodedToken.sub;
      setCurrentUser(loggedInUserId);

      if (paramUserId) {
        setViewedProfileId(paramUserId);
      } else {
        setViewedProfileId(loggedInUserId);
      }
    } catch (e) {
      console.error("Failed to decode token or token invalid:", e);
      localStorage.removeItem('jwt_token');
      navigate('/login');
    }
    console.log("aaaaaaaaaaaa" + viewedProfileId)
  }, [paramUserId, navigate]);

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!viewedProfileId || !currentUser) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const token = localStorage.getItem('jwt_token');
        if (!token) {
          throw new Error('Authentication token not found. Please log in.');
        }

        const headers = { 'Authorization': `Bearer ${token}` };

        const profileRes = await fetch(`${API_BASE_URL}/profile/${viewedProfileId}`, { headers });
        if (!profileRes.ok) {
          const errorData = await profileRes.json();
          throw new Error(errorData.message || 'Profile not found');
        }
        const profileData = await profileRes.json();
        setProfile(profileData);

        if (currentUser !== viewedProfileId) {
          const subRes = await fetch(`${API_BASE_URL}/profile/is-subscribed/${currentUser}/${viewedProfileId}`, { headers });
          if (!subRes.ok) throw new Error('Subscription check failed');
          const subData = await subRes.json();
          setIsSubscribed(subData?.exists || false);
        } else {
          setIsSubscribed(false);
        }

        const subsRes = await fetch(`${API_BASE_URL}/profile/subscribers/${viewedProfileId}`, { headers });
        if (!subsRes.ok) throw new Error('Failed to fetch subscribers');
        const subsData = await subsRes.json();
        setSubscribers(Array.isArray(subsData) ? subsData : []);

        const subscrRes = await fetch(`${API_BASE_URL}/profile/subscriptions/${viewedProfileId}`, { headers });
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
  }, [viewedProfileId, currentUser, navigate]);

  const handleSubscribe = async () => {
    console.log("Subscribe");
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
          streamerId: viewedProfileId,
        }),
      });

      if (res.ok) {

        setIsSubscribed(true);
        setProfile(prev => ({
          ...prev,
          subscriberCount: (prev?.subscriberCount || 0) + 1,
        }));
      } else {
        const errorData = await res.json();
        console.error('Subscribe error:', errorData.message || 'Failed to subscribe');
        setError(errorData.message || 'Failed to subscribe');
      }
    } catch (err) {
      console.error('Subscribe network error:', err);
      setError('Network error during subscription.');
    }
  };

  const handleUnsubscribe = async () => {
    setActionLoading(true); // Start action loading
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
          subscriberId: currentUser,
          streamerId: viewedProfileId,
        }),
      });

      if (res.ok) {
        setIsSubscribed(false);
        setProfile(prev => ({
          ...prev,
          subscriberCount: (prev?.subscriberCount || 0) - 1,
        }));
      } else {
        const errorData = await res.json();
        console.error('Unsubscribe error:', errorData.message || 'Failed to unsubscribe');
        setError(errorData.message || 'Failed to unsubscribe');
      }
    } catch (err) {
      console.error('Unsubscribe network error:', err);
      setError('Network error during unsubscription.');
    }
    finally {
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

  if (loading) return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500"></div>
      </div>
  );

  if (error) return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center p-6 bg-red-100 rounded-lg max-w-md">
          <h2 className="text-xl font-semibold text-red-800 mb-2">Error</h2>
          <p className="text-red-600">{error}</p>
          <button
              onClick={() => navigate('/')}
              className="mt-4 px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600 transition"
          >
            Go Home
          </button>
        </div>
      </div>
  );


  const isMyProfile = currentUser && viewedProfileId && currentUser === viewedProfileId;


  const showSubscribeButton = currentUser && viewedProfileId && currentUser !== viewedProfileId;


  return (
      <div className="min-h-screen bg-neutral-50 text-neutral-900">
        {/* Profile Header */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-400 py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="w-32 h-32 rounded-full bg-white flex items-center justify-center shadow-lg">
              <span className="text-4xl font-bold text-teal-600">
                {profile?.userName?.charAt(0).toUpperCase() || 'U'}
              </span>
              </div>

              <div className="flex-1 text-white">
                <h1 className="text-3xl font-bold mb-2">{profile?.userName}</h1>

                <div className="flex flex-wrap gap-4 mb-4">
                  <div className="flex items-center">
                    <Users className="w-5 h-5 mr-2" />
                    <span>{profile?.subscriberCount || 0} subscribers</span>
                  </div>

                  {profile?.isLive && (
                      <div className="flex items-center bg-red-500 px-3 py-1 rounded-full">
                        <div className="w-2 h-2 bg-white rounded-full animate-ping mr-2"></div>
                        <span>Live Now</span>
                      </div>
                  )}
                </div>

                {/* Conditional Rendering for Buttons */}
                <div className="flex gap-4 mt-4">
                  {isMyProfile && (
                      <button
                          onClick={() => navigate('/settings')} // Or whatever your settings route is
                          className="px-6 py-2 rounded-full font-medium flex items-center bg-teal-800 text-white hover:bg-teal-900 transition-colors"
                      >
                        <SettingsIcon className="w-5 h-5 mr-2" />
                        Settings
                      </button>
                  )}

                  {showSubscribeButton && (
                      <button
                          onClick={isSubscribed ? handleUnsubscribe : handleSubscribe}
                          className={`px-6 py-2 rounded-full font-medium flex items-center ${isSubscribed
                              ? 'bg-white text-teal-600 hover:bg-neutral-100'
                              : 'bg-teal-800 text-white hover:bg-teal-900'}`}
                      >
                        {actionLoading ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
                        ) : (
                            <Heart className={`w-5 h-5 mr-2 ${isSubscribed ? 'fill-teal-600 text-teal-600' : ''}`} />                        )
                        }
                        {actionLoading ? (isSubscribed ? 'Unsubscribing...' : 'Subscribing...') : (isSubscribed ? 'Subscribed' : 'Subscribe')}
                      </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Content (rest of your page remains the same) */}
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Main Profile Info */}
            <div className="md:col-span-2 bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <User className="w-5 h-5 mr-2 text-teal-600" />
                About
              </h2>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-neutral-500">Username</h3>
                  <p className="mt-1">{profile?.userName}</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-neutral-500">Email</h3>
                  <p className="mt-1 flex items-center">
                    <Mail className="w-4 h-4 mr-2 text-neutral-400" />
                    {profile?.email}
                  </p>
                </div>

                {profile?.birthdate && (
                    <div>
                      <h3 className="text-sm font-medium text-neutral-500">Birthdate</h3>
                      <p className="mt-1 flex items-center">
                        <Calendar className="w-4 h-4 mr-2 text-neutral-400" />
                        {formatDate(profile.birthdate)}
                      </p>
                    </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Subscribers */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <Users className="w-5 h-5 mr-2 text-teal-600" />
                  Subscribers
                </h2>

                {subscribers.length > 0 ? (
                    <div className="space-y-3">
                      {subscribers.slice(0, 5).map(sub => (
                          sub?.subscriber && (
                              <div
                                  key={sub._id}
                                  className="flex items-center cursor-pointer hover:bg-neutral-50 p-2 rounded"
                                  onClick={() => navigate(`/profile/${sub.subscriber._id}`)}
                              >
                                <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center mr-3">
                          <span className="text-sm font-medium text-teal-800">
                            {sub.subscriber.userName?.charAt(0).toUpperCase()}
                          </span>
                                </div>
                                <span className="font-medium">{sub.subscriber.userName}</span>
                              </div>
                          )
                      ))}
                      {subscribers.length > 5 && (
                          <p className="text-sm text-neutral-500 mt-2">
                            +{subscribers.length - 5} more
                          </p>
                      )}
                    </div>
                ) : (
                    <p className="text-neutral-500">No subscribers yet</p>
                )}
              </div>

              {/* Subscriptions */}
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <Heart className="w-5 h-5 mr-2 text-teal-600" />
                  Subscriptions
                </h2>

                {subscriptions.length > 0 ? (
                    <div className="space-y-3">
                      {subscriptions.slice(0, 5).map(sub => (
                          sub?.streamer && (
                              <div
                                  key={sub._id}
                                  className="flex items-center cursor-pointer hover:bg-neutral-50 p-2 rounded"
                                  onClick={() => navigate(`/profile/${sub.streamer._id}`)}
                              >
                                <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center mr-3">
                          <span className="text-sm font-medium text-teal-800">
                            {sub.streamer.userName?.charAt(0).toUpperCase()}
                          </span>
                                </div>
                                <span className="font-medium">{sub.streamer.userName}</span>
                              </div>
                          )
                      ))}
                      {subscriptions.length > 5 && (
                          <p className="text-sm text-neutral-500 mt-2">
                            +{subscriptions.length - 5} more
                          </p>
                      )}
                    </div>
                ) : (
                    <p className="text-neutral-500">Not subscribed to anyone</p>
                )}
              </div>
            </div>
          </div>

          {/* Recent Activity (placeholder) */}
          <div className="mt-8 bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <MessageSquare className="w-5 h-5 mr-2 text-teal-600" />
              Recent Activity
            </h2>
            <p className="text-neutral-500">Coming soon...</p>
          </div>
        </div>
      </div>
  );
};

export default ProfilePage;