
"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  doc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
} from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";


export default function SignupPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [bio, setBio] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("/images/default_avatar.png");
  const [avatarFile, setAvatarFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { toast } = useToast();
  const { signIn } = useAuth();


  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setAvatarPreview(result);
        setAvatarFile(result);
      };
      reader.readAsDataURL(file);
    }
  };


  const handleSignUp = async () => {
    // --- Start Validation ---
    if (!username.trim()) {
      toast({ title: "Lỗi", description: "Tên người dùng không được để trống.", variant: "destructive" });
      return;
    }
     if (!nickname.trim()) {
      toast({ title: "Lỗi", description: "Nickname không được để trống.", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Lỗi", description: "Mật khẩu phải có ít nhất 6 ký tự.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Lỗi", description: "Mật khẩu không khớp.", variant: "destructive" });
      return;
    }
    if (username.length > 15) {
      toast({ title: "Lỗi", description: "Tên người dùng không được quá 15 ký tự.", variant: "destructive" });
      return;
    }
    // --- End Validation ---

    setLoading(true);

    try {
      // 1. Check if username already exists
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("username", "==", username.trim()));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        toast({ title: "Lỗi", description: "Tên người dùng này đã tồn tại.", variant: "destructive" });
        setLoading(false);
        return;
      }
      
      // We need a document ID to name the avatar file. Let's create the doc first.
      const newUserRef = doc(collection(db, "users"));
      const userId = newUserRef.id;

      // 2. Upload avatar if it exists, otherwise use placeholder
      let avatarUrl = "/images/default_avatar.png";
      if (avatarFile) {
        try {
            const storageRef = ref(storage, `avatars/${userId}`);
            await uploadString(storageRef, avatarFile, 'data_url');
            avatarUrl = await getDownloadURL(storageRef);
        } catch (storageError) {
            console.error("Error uploading avatar: ", storageError);
            toast({ title: "Lỗi tải ảnh", description: "Không thể tải lên ảnh đại diện, sẽ sử dụng ảnh mặc định.", variant: "destructive" });
        }
      }

      // 3. Create user profile object
      const newUserProfile = {
        username: username.trim(),
        password: password, // Storing plain text password
        nickname: nickname,
        bio: bio,
        avatar: avatarUrl,
        role: 'user', // Default role
      };
      
      // 4. Save the user profile in Firestore
      await setDoc(newUserRef, newUserProfile);
      
      const userForSession = { ...newUserProfile, id: userId };
      // Omit password from session data
      // @ts-ignore
      delete userForSession.password;

      // 5. Sign in the new user
      signIn(userForSession);

      toast({
        title: "Thành công",
        description: "Tài khoản của bạn đã được tạo. Đang chuyển hướng...",
      });
      router.push("/");

    } catch (error: any) {
      console.error("Error signing up: ", error);
      toast({ title: "Lỗi", description: "Đã có lỗi xảy ra khi đăng ký. Vui lòng thử lại.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Tạo tài khoản Synergy Hub</CardTitle>
          <CardDescription>
            Nhập thông tin của bạn để bắt đầu
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
           <div className="space-y-2">
              <Label htmlFor="username">Tên người dùng</Label>
              <Input id="username" placeholder="Tối đa 15 ký tự" required value={username} onChange={(e) => setUsername(e.target.value.trim())} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mật khẩu</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Xác nhận mật khẩu</Label>
              <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            
            <div className="h-px w-full bg-border my-4"></div>

            <div className="flex items-center space-x-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={avatarPreview} data-ai-hint="avatar placeholder" />
                <AvatarFallback>AV</AvatarFallback>
              </Avatar>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                Chọn ảnh đại diện
              </Button>
              <input type="file" ref={fileInputRef} onChange={handleAvatarChange} className="hidden" accept="image/*" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nickname">Nickname</Label>
              <Input id="nickname" placeholder="Tên bạn muốn mọi người gọi" required value={nickname} onChange={(e) => setNickname(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Tiểu sử</Label>
              <Textarea id="bio" placeholder="Hãy cho chúng tôi biết một chút về bạn" value={bio} onChange={(e) => setBio(e.target.value)} />
            </div>

            <Button onClick={handleSignUp} disabled={loading} className="w-full">
              {loading ? "Đang tạo..." : "Tạo tài khoản và Hồ sơ"}
            </Button>

          <div className="mt-4 text-center text-sm">
            Đã có tài khoản?{" "}
            <Link href="/login" className="underline">
              Đăng nhập
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
