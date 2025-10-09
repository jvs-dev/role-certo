import { Injectable } from '@angular/core';
import { Auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, 
         User as FirebaseUser, GoogleAuthProvider, signInWithPopup, 
         updateProfile, onAuthStateChanged } from '@angular/fire/auth';
import { doc, Firestore, getDoc, setDoc, updateDoc } from '@angular/fire/firestore';
import { BehaviorSubject, Observable } from 'rxjs';
import { User } from '../models/interfaces';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private auth: Auth,
    private firestore: Firestore
  ) {
    this.initAuthState();
  }

  private initAuthState(): void {
    onAuthStateChanged(this.auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userData = await this.getUserData(firebaseUser.uid);
        this.currentUserSubject.next(userData);
      } else {
        this.currentUserSubject.next(null);
      }
    });
  }

  async signInWithEmail(email: string, password: string): Promise<void> {
    try {
      await signInWithEmailAndPassword(this.auth, email, password);
    } catch (error) {
      throw error;
    }
  }

  async signInWithGoogle(): Promise<void> {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(this.auth, provider);
      
      if (result.user) {
        // Check if user exists in Firestore, if not create it
        const userDoc = await getDoc(doc(this.firestore, 'users', result.user.uid));
        if (!userDoc.exists()) {
          await this.createUserDocument(result.user);
        }
      }
    } catch (error) {
      throw error;
    }
  }

  async signUp(email: string, password: string, displayName: string): Promise<void> {
    try {
      const result = await createUserWithEmailAndPassword(this.auth, email, password);
      
      if (result.user) {
        // Update Firebase Auth profile
        await updateProfile(result.user, { displayName });
        
        // Create user document in Firestore
        await this.createUserDocument(result.user, displayName);
      }
    } catch (error) {
      throw error;
    }
  }

  async signOut(): Promise<void> {
    await signOut(this.auth);
  }

  private async createUserDocument(firebaseUser: FirebaseUser, displayName?: string): Promise<void> {
    const userData: User = {
      uid: firebaseUser.uid,
      displayName: displayName || firebaseUser.displayName || '',
      email: firebaseUser.email || '',
      photoURL: firebaseUser.photoURL || '',
      bio: '',
      location: { city: '', state: '' },
      createdEvents: [],
      attendingEvents: []
    };

    await setDoc(doc(this.firestore, 'users', firebaseUser.uid), userData);
  }

  private async getUserData(uid: string): Promise<User | null> {
    try {
      const userDoc = await getDoc(doc(this.firestore, 'users', uid));
      if (userDoc.exists()) {
        return userDoc.data() as User;
      }
      return null;
    } catch (error) {
      console.error('Error getting user data:', error);
      return null;
    }
  }

  async updateUserProfile(userData: Partial<User>): Promise<void> {
    const currentUser = this.auth.currentUser;
    if (currentUser) {
      await updateDoc(doc(this.firestore, 'users', currentUser.uid), userData);
      
      // Update local state
      const updatedUser = { ...this.currentUserSubject.value, ...userData } as User;
      this.currentUserSubject.next(updatedUser);
    }
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  isAuthenticated(): boolean {
    return !!this.currentUserSubject.value;
  }
}