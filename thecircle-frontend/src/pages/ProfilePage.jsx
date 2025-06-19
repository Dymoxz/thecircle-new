import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Mail, Calendar, Users, Heart, MessageSquare } from 'lucide-react';

// Vite gebruikt import.meta.env voor environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Controleer of de environment variable is ingesteld
if (!API_BASE_URL) {
  console.error('VITE_API_BASE_URL is not defined in .env file');
  // Optioneel: fallback URL voor development
  // const API_BASE_URL = 'http://localhost:3001/api';
}

const ProfilePage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribers, setSubscribers] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser] = useState(localStorage.getItem('userId'));

useEffect(() => {
  const fetchProfile = async () => {
    try {
      setLoading(true);
      
      // Fetch profile data
      const profileRes = await fetch(`${API_BASE_URL}/profile/${userId}`);
      if (!profileRes.ok) throw new Error('Profile not found');
      const profileData = await profileRes.json();
      if (!profileData) throw new Error('No profile data received');
      setProfile(profileData);
      
      // Check subscription status if logged in
      if (currentUser && currentUser !== userId) {
        const subRes = await fetch(`${API_BASE_URL}/profile/is-subscribed/${currentUser}/${userId}`);
        if (!subRes.ok) throw new Error('Subscription check failed');
        const subData = await subRes.json();
        setIsSubscribed(subData?.exists || false);
      }
      
      // Fetch subscribers
      const subsRes = await fetch(`${API_BASE_URL}/profile/subscribers/${userId}`);
      if (!subsRes.ok) throw new Error('Failed to fetch subscribers');
      const subsData = await subsRes.json();
      setSubscribers(Array.isArray(subsData) ? subsData : []);
      
      // Fetch subscriptions
      const subscrRes = await fetch(`${API_BASE_URL}/profile/subscriptions/${userId}`);
      if (!subscrRes.ok) throw new Error('Failed to fetch subscriptions');
      const subscrData = await subscrRes.json();
      setSubscriptions(Array.isArray(subscrData) ? subscrData : []);
      
    } catch (err) {
      setError(err.message);
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  fetchProfile();
}, [userId, currentUser]);

  const handleSubscribe = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/profile/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriberId: currentUser,
          streamerId: userId
        })
      });
      
      if (res.ok) {
        setIsSubscribed(true);
        setProfile(prev => ({
          ...prev,
          subscriberCount: prev.subscriberCount + 1
        }));
      }
    } catch (err) {
      console.error('Subscribe error:', err);
    }
  };

  const handleUnsubscribe = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/profile/unsubscribe`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriberId: currentUser,
          streamerId: userId
        })
      });
      
      if (res.ok) {
        setIsSubscribed(false);
        setProfile(prev => ({
          ...prev,
          subscriberCount: prev.subscriberCount - 1
        }));
      }
    } catch (err) {
      console.error('Unsubscribe error:', err);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
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
              
              {currentUser && currentUser !== userId && (
                <button
                  onClick={isSubscribed ? handleUnsubscribe : handleSubscribe}
                  className={`px-6 py-2 rounded-full font-medium flex items-center ${isSubscribed 
                    ? 'bg-white text-teal-600 hover:bg-neutral-100' 
                    : 'bg-teal-800 text-white hover:bg-teal-900'}`}
                >
                  <Heart className="w-5 h-5 mr-2" />
                  {isSubscribed ? 'Subscribed' : 'Subscribe'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Profile Content */}
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