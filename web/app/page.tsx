"use client";
import ChatInterface from "@/components/chat";
import { useEffect } from "react";

export default function Home() {
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("http://localhost:8000/api/v1/health");
        const data = await response.json();
        console.log(data);
      } catch (error) {
        console.log("ERROR: ", error);
      }
    };
    fetchData();
  }, []);

  return (
    <>
      <ChatInterface />
    </>
  );
}
