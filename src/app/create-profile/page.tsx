"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, setDoc } from "firebase/firestore";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";

export default function CreateProfilePage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [nickname, setNickname] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("https://placehold.co/128x128.png");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) {
      toast({
        title: "Lỗi",
        description: "Bạn cần phải đăng nhập để tạo hồ sơ.",
        variant: "destructive",
      });
      return;
    }

    if (!nickname.trim()) {
      toast({
        title: "Lỗi",
        description: "Nickname không được để trống.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // In a real app, you'd upload the avatar to Firebase Storage
      // and get a URL. For now, we'll just save the data URL or placeholder.
      await setDoc(doc(db, "users", user.uid), {
        nickname: nickname,
        bio: bio,
        avatar: avatar,
      });
      toast({
        title: "Thành công",
        description: "Hồ sơ của bạn đã được tạo.",
      });
      router.push("/");
    } catch (error) {
      console.error("Error creating profile: ", error);
      toast({
        title: "Lỗi",
        description: "Đã có lỗi xảy ra khi tạo hồ sơ. Vui lòng thử lại.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Tạo hồ sơ của bạn</CardTitle>
          <CardDescription>
            Thêm một chút thông tin về bản thân.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={avatar} />
              <AvatarFallback>AV</AvatarFallback>
            </Avatar>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              Thay đổi ảnh đại diện
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarChange}
              className="hidden"
              accept="image/*"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nickname">Nickname</Label>
            <Input
              id="nickname"
              placeholder="Tên bạn muốn mọi người gọi"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">Tiểu sử</Label>
            <Textarea
              id="bio"
              placeholder="Hãy cho chúng tôi biết một chút về bạn"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button className="w-full" onClick={handleSaveProfile} disabled={loading}>
            {loading ? "Đang lưu..." : "Lưu hồ sơ"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
