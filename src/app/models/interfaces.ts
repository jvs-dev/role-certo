export interface User {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  bio: string;
  location: {
    city: string;
    state: string;
  };
  createdEvents: string[];
  attendingEvents: string[];
}

export interface Event {
  eventId: string;
  eventName: string;
  location: {
    address: string;
    city: string;
    state: string;
  };
  coordinates?: {
    lat: number;
    lng: number;
  };
  eventDate: Date;
  eventTime: string;
  minAge: number;
  details: string;
  whatsappLink: string;
  maxParticipants: number;
  participants: string[];
  privacy: 'aberta' | 'fechada';
  creatorId: string;
  creatorName: string;
  creatorPhotoURL: string;
  imageUrl?: string; // Optional event image URL
}

export interface EventFormData {
  eventName: string;
  location: {
    address: string;
    city: string;
    state: string;
  };
  coordinates?: {
    lat: number;
    lng: number;
  } | null;
  eventDate: string;
  eventTime: string;
  minAge: number;
  details: string;
  whatsappLink: string;
  maxParticipants: number;
  privacy: 'aberta' | 'fechada';
  imageUrl?: string; // Optional image URL
}

export interface UserProfile {
  displayName: string;
  bio: string;
  location: {
    city: string;
    state: string;
  };
  photoURL?: string; // Changed from photoFile to photoURL for consistency
}

export interface Pico {
  picoId: string;
  picoName: string;
  description: string;
  location: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  creatorId: string;
  creatorName: string;
  photos: string[]; // Array of image URLs
  averageRating: number;
  ratingCount: number;
  createdAt?: any; // Firebase Timestamp (optional for compatibility)
}

export interface PicoFormData {
  picoName: string;
  description: string;
  location: string;
  coordinates: {
    lat: number;
    lng: number;
  } | null;
  photos: string[]; // Array of image URLs
}

export interface Review {
  reviewId: string;
  userId: string;
  userName: string;
  userPhotoURL: string;
  rating: number; // 1 to 5
  comment: string;
  createdAt: any; // Firebase Timestamp
  media: string[]; // Array of media URLs (photos/videos)
}

export interface ReviewFormData {
  rating: number; // 1 to 5
  comment: string;
  media: string[]; // Array of media URLs
}