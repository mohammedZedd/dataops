export interface ReplyTo {
  id: string;
  content: string;
  file_name?: string;
  sender_role: string;
}

export interface Msg {
  id: string;
  conversation_id?: string;
  sender_id: string;
  sender_role: string;
  content: string;
  message_type?: string;
  file_name?: string;
  file_url?: string;
  document_id?: string;
  reply_to_id?: string;
  reply_to?: ReplyTo | null;
  is_read: boolean;
  created_at: string;
}

export interface Conv {
  id: string;
  client_id: string | null;
  client_name: string | null;
  client_company: string | null;
  status: string;
  last_message: { content: string; sender_role: string; created_at: string } | null;
  unread_count: number;
  last_message_at: string | null;
}

export interface PendingFile {
  file: File;
  objectUrl: string | null;
}

export interface ReplyToState extends ReplyTo {
  isMe: boolean;
}
