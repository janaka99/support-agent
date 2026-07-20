"use client";
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

  const sendTest = async () => {
    try {
      console.log("Sending test");
      const response = await fetch("http://localhost:8000/api/v1/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Test",
        }),
      });
      const data = await response.json();
      console.log("response ", data);
    } catch (error) {
      console.log("ERROR: ", error);
    }
  };

  return (
    <>
      <div> Hellow world 3</div>
      <button onClick={sendTest}>Send Test</button>
    </>
  );
}
