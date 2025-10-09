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