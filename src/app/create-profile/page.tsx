"use client";

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

export default function CreateProfilePage() {
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
              <AvatarImage src="https://placehold.co/128x128.png" />
              <AvatarFallback>AV</AvatarFallback>
            </Avatar>
            <Button variant="outline">Thay đổi ảnh đại diện</Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nickname">Nickname</Label>
            <Input id="nickname" placeholder="Tên bạn muốn mọi người gọi" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">Tiểu sử</Label>
            <Textarea id="bio" placeholder="Hãy cho chúng tôi biết một chút về bạn" />
          </div>
        </CardContent>
        <CardFooter>
          <Button className="w-full">Lưu hồ sơ</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
