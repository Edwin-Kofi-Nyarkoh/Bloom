import BloomChatbot from "@/components/chatbot/BloomChatbot";

export default function ChatPage() {
  return (
    <>
      <BloomChatbot />
      <p className="px-2 text-center text-xs text-muted">
        Bloom AI gives general information, not medical advice. Chats are deleted after 30 days.
      </p>
    </>
  );
}
