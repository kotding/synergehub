"use client";

import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
  useCallback,
} from "react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";

interface UserProfile {
  id: string; // Firestore document ID
  username: string;
  nickname: string;
  bio: string;
  avatar: string;
  role: 'user' | 'admin';
}

interface AuthContextType {
  user: UserProfile | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => void;
  signIn: (userProfile: UserProfile) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    setLoading(true);
    try {
      const storedUser = localStorage.getItem("synergy-user");
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser) as UserProfile;
        setUser(parsedUser);
        
        // Listen for profile changes in real-time
        const unsubProfile = onSnapshot(doc(db, "users", parsedUser.id), (doc) => {
          if (doc.exists()) {
            const userProfile = { id: doc.id, ...doc.data() } as UserProfile;
            setProfile(userProfile);
            // Also update the user in state and local storage in case of changes
            setUser(userProfile); 
            localStorage.setItem("synergy-user", JSON.stringify(userProfile));
          } else {
            // The user was deleted from Firestore, log them out.
            signOut();
          }
          setLoading(false);
        });

        return () => unsubProfile(); // Cleanup profile listener
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    } catch (error) {
      console.error("Failed to process stored user:", error);
      // Clear potentially corrupted data
      localStorage.removeItem("synergy-user");
      setUser(null);
      setProfile(null);
      setLoading(false);
    }
  }, []);

  const signIn = useCallback((userProfile: UserProfile) => {
    localStorage.setItem("synergy-user", JSON.stringify(userProfile));
    setUser(userProfile);
    setProfile(userProfile);
  }, []);
  
  const signOut = useCallback(() => {
    localStorage.removeItem("synergy-user");
    setUser(null);
    setProfile(null);
    // Redirect to login page after sign out
    router.push('/login');
  }, [router]);

  const value = { user, profile, loading, signOut, signIn };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};