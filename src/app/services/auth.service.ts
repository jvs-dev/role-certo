import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, 
         User as FirebaseUser, GoogleAuthProvider, signInWithPopup, 
         updateProfile, onAuthStateChanged, setPersistence, browserLocalPersistence, browserSessionPersistence } from '@angular/fire/auth';
import { doc, Firestore, getDoc, setDoc, updateDoc } from '@angular/fire/firestore';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { User } from '../models/interfaces';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private authStateInitialized = new BehaviorSubject<boolean>(false);
  public authReady$ = this.authStateInitialized.asObservable();
  private isBrowser: boolean;

  constructor(
    private auth: Auth,
    private firestore: Firestore,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    
    // Only initialize auth state in browser
    if (this.isBrowser) {
      // Initialize auth state listener immediately
      this.initAuthState();
    } else {
      // Mark as initialized immediately on server
      this.authStateInitialized.next(true);
    }
  }

  private async setDefaultPersistence(): Promise<void> {
    // Removed default persistence setting to avoid constructor errors
    // Persistence will be set individually in sign-in methods
  }

  private initAuthState(): void {
    if (!this.isBrowser) return;
    
    console.log('Initializing auth state listener...');
    
    onAuthStateChanged(this.auth, async (firebaseUser) => {
      console.log('Auth state changed:', firebaseUser ? firebaseUser.uid : 'No user');
      
      if (firebaseUser) {
        console.log('Firebase user detected, fetching user data from Firestore');
        const userData = await this.getUserData(firebaseUser.uid);
        console.log('User data loaded:', userData ? 'Success' : 'Failed');
        this.currentUserSubject.next(userData);
      } else {
        console.log('No Firebase user, setting currentUser to null');
        this.currentUserSubject.next(null);
      }
      
      // Mark auth as initialized after first state change
      if (!this.authStateInitialized.value) {
        this.authStateInitialized.next(true);
        console.log('Auth state initialized');
      }
    });
  }

  async signInWithEmail(email: string, password: string, rememberMe: boolean = true): Promise<void> {
    if (!this.isBrowser) throw new Error('Auth operations only available in browser');
    
    try {
      // Set persistence with retry logic
      const persistenceType = rememberMe ? browserLocalPersistence : browserSessionPersistence;
      await this.setPersistenceSafely(persistenceType);
      
      console.log(`Persistence set to ${rememberMe ? 'LOCAL' : 'SESSION'} for email sign-in`);
      
      await signInWithEmailAndPassword(this.auth, email, password);
      console.log('Email sign-in successful');
    } catch (error) {
      console.error('Error in email sign-in:', error);
      throw error;
    }
  }

  async signInWithGoogle(): Promise<void> {
    if (!this.isBrowser) throw new Error('Auth operations only available in browser');
    
    try {
      // Set persistence with retry logic - always LOCAL for Google
      await this.setPersistenceSafely(browserLocalPersistence);
      
      console.log('Persistence set to LOCAL for Google sign-in');
      
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(this.auth, provider);
      
      if (result.user) {
        // Check if user exists in Firestore, if not create it
        const userDoc = await getDoc(doc(this.firestore, 'users', result.user.uid));
        if (!userDoc.exists()) {
          await this.createUserDocument(result.user);
        }
      }
      
      console.log('Google sign-in successful');
    } catch (error) {
      console.error('Error in Google sign-in:', error);
      throw error;
    }
  }

  private async setPersistenceSafely(persistenceType: any): Promise<void> {
    const maxRetries = 3;
    let retries = 0;
    
    while (retries < maxRetries) {
      try {
        await setPersistence(this.auth, persistenceType);
        return; // Success
      } catch (error: any) {
        retries++;
        console.warn(`setPersistence attempt ${retries} failed:`, error.message);
        
        if (retries >= maxRetries) {
          console.error('Failed to set persistence after max retries, continuing anyway');
          return; // Don't throw, continue with default persistence
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 100 * retries));
      }
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
    console.log('Signing out user');
    await signOut(this.auth);
    console.log('User signed out successfully');
    // Note: We don't clear saved credentials here as they should persist
    // if the user selected "remember me". They will be cleared only if
    // the user unchecks "remember me" on the next login attempt.
  }

  private async createUserDocument(firebaseUser: FirebaseUser, displayName?: string): Promise<void> {
    // Default avatar for email/password signups (when no photoURL from provider)
    const defaultAvatar = 'https://cdn.vectorstock.com/i/500p/29/52/faceless-male-avatar-in-hoodie-vector-56412952.jpg';
    
    const userData: User = {
      uid: firebaseUser.uid,
      displayName: displayName || firebaseUser.displayName || '',
      email: firebaseUser.email || '',
      // Use Google photo if available, otherwise use default avatar
      photoURL: firebaseUser.photoURL || defaultAvatar,
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

  async waitForAuthReady(): Promise<boolean> {
    if (!this.isBrowser) return false;
    
    // Wait for auth state to be initialized
    await firstValueFrom(this.authReady$.pipe(filter(ready => ready)));
    
    // Return current authentication status
    return this.isAuthenticated();
  }

  // Observable that emits true when user is authenticated, false when not
  // Only emits after auth state has been initialized
  get isAuthenticated$(): Observable<boolean> {
    return this.authReady$.pipe(
      filter(ready => ready),
      map(() => this.isAuthenticated())
    );
  }
}