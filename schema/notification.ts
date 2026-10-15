export interface NotificationQueryResponse {
  rows: {
    id: number;
    title: string;
    message: string;
    type: string;
    is_read: boolean;
    created_at: number;
  }[];
  total_unread: number;
}
