import { User, Lead, MarketingProject, Task, KanbanBoard, KanbanColumn, KanbanCard, Activity } from '@prisma/client'

// Re-export Prisma types
export type { User, Lead, MarketingProject, Task, KanbanBoard, KanbanColumn, KanbanCard, Activity }

// Extended types with relations
export type LeadWithRelations = Lead & {
  assignedTo?: User | null
  tasks: Task[]
  activities: Activity[]
}

export type ProjectWithRelations = MarketingProject & {
  owner: User
  tasks: Task[]
  kanbanBoards: KanbanBoard[]
}

export type TaskWithRelations = Task & {
  assignedTo?: User | null
  project?: MarketingProject | null
  lead?: Lead | null
}

export type KanbanBoardWithRelations = KanbanBoard & {
  columns: (KanbanColumn & {
    cards: (KanbanCard & {
      assignedTo?: User | null
    })[]
  })[]
}

// API Response types
export type ApiResponse<T> = {
  success: boolean
  data?: T
  error?: string
}

// Dashboard types
export type DashboardStats = {
  totalLeads: number
  newLeads: number
  conversionRate: number
  totalRevenue: number
  activeProjets: number
  pendingTasks: number
}

export type LeadsByStatus = {
  status: string
  count: number
}

export type LeadsBySource = {
  source: string
  count: number
}

// Lead status
export enum LeadStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  QUALIFIED = 'qualified',
  PROPOSAL = 'proposal',
  NEGOTIATION = 'negotiation',
  WON = 'won',
  LOST = 'lost',
}

// Task status
export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  DONE = 'done',
  CANCELLED = 'cancelled',
}

// Task priority
export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

// Project status
export enum ProjectStatus {
  PLANNING = 'planning',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

// User roles
export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  USER = 'user',
}

// Chatwoot types
export type ChatwootContact = {
  id: number
  name: string
  email?: string
  phone_number?: string
  identifier?: string
  custom_attributes?: Record<string, any>
}

export type ChatwootConversation = {
  id: number
  contact_id: number
  inbox_id: number
  status: string
  messages: ChatwootMessage[]
}

export type ChatwootMessage = {
  id: number
  content: string
  message_type: string
  created_at: string
  sender?: {
    name: string
  }
}

export type ChatwootWebhook = {
  event: string
  data: any
  account_id: number
}
