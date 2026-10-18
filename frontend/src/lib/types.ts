export type Role = "admin" | "teacher" | "student";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export interface College {
  id: string;
  name: string;
  city: string;
  state: string;
  country: string;
  description: string | null;
  website: string | null;
  established_year: number | null;
  courses: string[];
  average_rating: number | null;
  review_count: number;
  created_at: string;
  updated_at: string;
}

export type Star = "1" | "2" | "3" | "4" | "5";

export interface CollegeDetail extends College {
  rating_distribution: Record<Star, number>;
}

export interface Review {
  id: string;
  college_id: string;
  author_id: string;
  rating: number;
  title: string;
  comment: string;
  author: { id: string; name: string; role: Role } | null;
  college: { id: string; name: string } | null;
  created_at: string;
  updated_at: string;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

export interface ApiErrorDetail {
  location: string | null;
  field: string | null;
  message: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details: ApiErrorDetail[] | null;
}

export type CollegeSort =
  "name" | "-name" | "rating" | "-rating" | "reviews" | "-reviews" | "newest" | "oldest";

export type ReviewSort = "newest" | "oldest" | "rating" | "-rating" | "relevance";
