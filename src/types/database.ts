/* Database types generated from Supabase schema */
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: Organization
        Insert: OrganizationInsert
        Update: OrganizationUpdate
        Relationships: []
      }
      profiles: {
        Row: Profile
        Insert: ProfileInsert
        Update: ProfileUpdate
        Relationships: []
      }
      spaces: {
        Row: Space
        Insert: SpaceInsert
        Update: SpaceUpdate
        Relationships: []
      }
      areas: {
        Row: Area
        Insert: AreaInsert
        Update: AreaUpdate
        Relationships: []
      }
      memberships: {
        Row: Membership
        Insert: MembershipInsert
        Update: MembershipUpdate
        Relationships: []
      }
      task_templates: {
        Row: TaskTemplate
        Insert: TaskTemplateInsert
        Update: TaskTemplateUpdate
        Relationships: []
      }
      tasks: {
        Row: Task
        Insert: TaskInsert
        Update: TaskUpdate
        Relationships: []
      }
      task_instances: {
        Row: TaskInstance
        Insert: TaskInstanceInsert
        Update: TaskInstanceUpdate
        Relationships: []
      }
      task_completions: {
        Row: TaskCompletion
        Insert: TaskCompletionInsert
        Update: TaskCompletionUpdate
        Relationships: []
      }
      issues: {
        Row: Issue
        Insert: IssueInsert
        Update: IssueUpdate
        Relationships: []
      }
      issue_events: {
        Row: IssueEvent
        Insert: IssueEventInsert
        Update: IssueEventUpdate
        Relationships: []
      }
      issue_patterns: {
        Row: IssuePattern
        Insert: IssuePatternInsert
        Update: IssuePatternUpdate
        Relationships: []
      }
      supply_items: {
        Row: SupplyItem
        Insert: SupplyItemInsert
        Update: SupplyItemUpdate
        Relationships: []
      }
      supply_requests: {
        Row: SupplyRequest
        Insert: SupplyRequestInsert
        Update: SupplyRequestUpdate
        Relationships: []
      }
      notification_preferences: {
        Row: NotificationPreference
        Insert: NotificationPreferenceInsert
        Update: NotificationPreferenceUpdate
        Relationships: []
      }
      notifications: {
        Row: Notification
        Insert: NotificationInsert
        Update: NotificationUpdate
        Relationships: []
      }
      recommendations: {
        Row: Recommendation
        Insert: RecommendationInsert
        Update: RecommendationUpdate
        Relationships: []
      }
      audit_events: {
        Row: AuditEvent
        Insert: AuditEventInsert
        Update: AuditEventUpdate
        Relationships: []
      }
      teams: {
        Row: Team
        Insert: TeamInsert
        Update: TeamUpdate
        Relationships: []
      }
      team_members: {
        Row: TeamMember
        Insert: TeamMemberInsert
        Update: TeamMemberUpdate
        Relationships: []
      }
      task_assignments: {
        Row: TaskAssignment
        Insert: TaskAssignmentInsert
        Update: TaskAssignmentUpdate
        Relationships: []
      }
      task_comments: {
        Row: TaskComment
        Insert: TaskCommentInsert
        Update: TaskCommentUpdate
        Relationships: []
      }
      task_swaps: {
        Row: TaskSwap
        Insert: TaskSwapInsert
        Update: TaskSwapUpdate
        Relationships: []
      }
      member_away: {
        Row: MemberAway
        Insert: MemberAwayInsert
        Update: MemberAwayUpdate
        Relationships: []
      }
      invitations: {
        Row: Invitation
        Insert: InvitationInsert
        Update: InvitationUpdate
        Relationships: []
      }
      task_dependencies: {
        Row: TaskDependency
        Insert: TaskDependencyInsert
        Update: TaskDependencyUpdate
        Relationships: []
      }
      task_checklist_items: {
        Row: TaskChecklistItem
        Insert: TaskChecklistItemInsert
        Update: TaskChecklistItemUpdate
        Relationships: []
      }
      task_checklist_results: {
        Row: TaskChecklistResult
        Insert: TaskChecklistResultInsert
        Update: TaskChecklistResultUpdate
        Relationships: []
      }
      shared_device_pins: {
        Row: SharedDevicePin
        Insert: SharedDevicePinInsert
        Update: SharedDevicePinUpdate
        Relationships: []
      }
      shared_device_sessions: {
        Row: SharedDeviceSession
        Insert: SharedDeviceSessionInsert
        Update: SharedDeviceSessionUpdate
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: { space_id: string; roles: string[] }
        Returns: boolean
      }
      get_user_spaces: {
        Args: { user_id: string }
        Returns: Space[]
      }
      get_space_members: {
        Args: { space_id: string }
        Returns: Membership[]
      }
      create_space_with_owner: {
        Args: {
          p_name: string
          p_type: SpaceType
          p_timezone: string
          p_modules?: SpaceModules
          p_settings?: SpaceSettings
          p_organization_name?: string | null
        }
        Returns: Space
      }
      replace_task_rotation_members: {
        Args: { p_task_id: string; p_user_ids: string[] }
        Returns: undefined
      }
      create_team: {
        Args: { p_space_id: string; p_name: string; p_description?: string | null; p_color?: string | null }
        Returns: Team
      }
      update_team: {
        Args: { p_team_id: string; p_name?: string | null; p_description?: string | null; p_color?: string | null }
        Returns: Team
      }
      add_team_member: {
        Args: { p_team_id: string; p_user_id: string; p_role?: string }
        Returns: TeamMember
      }
      create_invitation: {
        Args: { p_space_id: string; p_email?: string | null; p_role?: MembershipRole; p_expires_at?: string | null }
        Returns: Invitation
      }
      accept_invitation: {
        Args: { p_token: string }
        Returns: Membership
      }
      set_away: {
        Args: { p_space_id: string; p_type: AwayType; p_starts_at: string; p_ends_at?: string | null; p_reason?: string | null }
        Returns: MemberAway
      }
      request_swap: {
        Args: { p_task_instance_id: string; p_requested_to?: string | null; p_reason?: string | null }
        Returns: TaskSwap
      }
      respond_swap: {
        Args: { p_swap_id: string; p_response: string }
        Returns: TaskSwap
      }
      cancel_swap: {
        Args: { p_swap_id: string }
        Returns: undefined
      }
      revoke_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      complete_task_instance: {
        Args: {
          p_instance_id: string
          p_notes?: string | null
          p_duration_minutes?: number | null
          p_photos?: string[]
          p_device_session_token?: string | null
        }
        Returns: TaskInstance
      }
      undo_task_completion: {
        Args: { p_instance_id: string; p_device_session_token?: string | null }
        Returns: TaskInstance
      }
      skip_task_instance: {
        Args: {
          p_instance_id: string
          p_reason?: string | null
          p_device_session_token?: string | null
        }
        Returns: TaskInstance
      }
      reopen_task_instance: {
        Args: { p_instance_id: string; p_device_session_token?: string | null }
        Returns: TaskInstance
      }
      fresh_start_space: {
        Args: { p_space_id: string }
        Returns: number
      }
      refresh_space_issue_patterns: {
        Args: { p_space_id: string; p_window_days?: number }
        Returns: number
      }
      create_issue: {
        Args: {
          p_space_id: string
          p_area_id: string | null
          p_category: IssueCategory
          p_custom_category: string | null
          p_title: string
          p_description: string | null
          p_priority?: IssuePriority
          p_photos?: string[]
          p_due_at?: string | null
          p_source_instance_id?: string | null
          p_source_checklist_item_id?: string | null
          p_device_session_token?: string | null
        }
        Returns: Issue
      }
      rotate_area_qr_token: {
        Args: { p_area_id: string }
        Returns: string
      }
      lookup_area_by_qr_token: {
        Args: { p_token: string }
        Returns: QrAreaLookup | null
      }
      set_shared_device_pin: {
        Args: { p_space_id: string; p_pin: string }
        Returns: undefined
      }
      remove_shared_device_pin: {
        Args: { p_space_id: string }
        Returns: undefined
      }
      shared_device_pin_status: {
        Args: { p_space_id: string }
        Returns: { has_pin: boolean; locked_until: string | null }
      }
      list_shared_device_members: {
        Args: { p_space_id: string }
        Returns: SharedDeviceMember[]
      }
      open_shared_device_session: {
        Args: { p_space_id: string; p_user_id: string; p_pin: string }
        Returns: Json
      }
      get_shared_device_session: {
        Args: { p_space_id: string; p_token: string }
        Returns: Json
      }
      close_shared_device_session: {
        Args: { p_token: string }
        Returns: undefined
      }
      get_my_privacy_export: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      prepare_my_account_deletion: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      log_self_service_audit: {
        Args: { p_action: string }
        Returns: undefined
      }
      replace_task_checklist: {
        Args: { p_task_id: string; p_labels: string[] }
        Returns: undefined
      }
      save_checklist_result: {
        Args: {
          p_instance_id: string
          p_checklist_item_id: string
          p_status: ChecklistResultStatus
          p_note?: string | null
          p_issue_id?: string | null
          p_device_session_token?: string | null
        }
        Returns: TaskChecklistResult
      }
      attach_task_evidence: {
        Args: {
          p_instance_id: string
          p_photos: string[]
          p_device_session_token?: string | null
        }
        Returns: TaskCompletion
      }
      verify_task_instance: {
        Args: {
          p_instance_id: string
          p_note?: string | null
          p_device_session_token?: string | null
        }
        Returns: TaskInstance
      }
      request_task_rework: {
        Args: {
          p_instance_id: string
          p_note: string
          p_device_session_token?: string | null
        }
        Returns: TaskInstance
      }
      purge_expired_task_evidence: {
        Args: { p_space_id?: string | null }
        Returns: number
      }
      assign_issue: {
        Args: {
          p_issue_id: string
          p_assignee_id?: string | null
          p_team_id?: string | null
          p_external_service?: string | null
          p_due_at?: string | null
          p_note?: string | null
          p_clear_due_date?: boolean
        }
        Returns: Issue
      }
      start_issue: {
        Args: { p_issue_id: string; p_note?: string | null }
        Returns: Issue
      }
      resolve_issue: {
        Args: { p_issue_id: string; p_resolution_note: string }
        Returns: Issue
      }
      verify_issue: {
        Args: { p_issue_id: string; p_note?: string | null }
        Returns: Issue
      }
      reopen_issue: {
        Args: { p_issue_id: string; p_note: string }
        Returns: Issue
      }
      add_issue_comment: {
        Args: { p_issue_id: string; p_comment: string }
        Returns: IssueEvent
      }
      attach_issue_photos: {
        Args: { p_issue_id: string; p_photos: string[] }
        Returns: Issue
      }
      convert_issue_to_task: {
        Args: { p_issue_id: string; p_due_at?: string | null }
        Returns: Task
      }
    }
    Enums: {
      space_type: 'personal' | 'shared_home' | 'workplace' | 'institution' | 'healthcare' | 'custom'
      membership_role: 'owner' | 'admin' | 'supervisor' | 'member' | 'cleaner' | 'auditor'
      task_status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'overdue'
      task_frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom'
      issue_status: 'reported' | 'acknowledged' | 'in_progress' | 'resolved' | 'closed' | 'reopened'
      issue_priority: 'low' | 'medium' | 'high' | 'urgent'
      supply_status: 'available' | 'low' | 'out_of_stock' | 'ordered'
      request_status: 'pending' | 'approved' | 'rejected' | 'fulfilled'
      invitation_status: 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired'
      swap_status: 'pending' | 'accepted' | 'declined' | 'cancelled'
      away_type: 'illness' | 'travel' | 'personal' | 'other'
      recommendation_type: 'rebalance' | 'schedule' | 'supply' | 'maintenance' | 'other'
      recommendation_action: 'accept' | 'edit' | 'dismiss' | 'disable'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

/* Organizations */
export type Organization = {
  id: string
  name: string
  created_by: string
  settings: Json
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type OrganizationInsert = {
  id?: string
  name: string
  created_by: string
  settings?: Json
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

export type OrganizationUpdate = {
  name?: string
  settings?: Json
  updated_at?: string
  deleted_at?: string | null
}

/* Spaces */
export type Profile = {
  id: string
  full_name: string | null
  language: string
  theme: 'light' | 'dark' | 'system'
  created_at: string
  updated_at: string
}

export type ProfileInsert = {
  id?: string
  full_name?: string | null
  language?: string
  theme?: 'light' | 'dark' | 'system'
  created_at?: string
  updated_at?: string
}

export type ProfileUpdate = {
  full_name?: string | null
  language?: string
  theme?: 'light' | 'dark' | 'system'
  updated_at?: string
}

export type Space = {
  id: string
  organization_id: string
  name: string
  type: SpaceType
  timezone: string
  settings: SpaceSettings
  modules: SpaceModules
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type SpaceSettings = {
  theme?: 'light' | 'dark' | 'system'
  language?: string
  dateFormat?: string
  timeFormat?: '12h' | '24h'
  weekStart?: 0 | 1 | 6
  notificationsEnabled?: boolean
  photosEnabled?: boolean
  qrCodeEnabled?: boolean
  building?: string
  floor?: string
  zone?: string
  evidenceRule?: EvidenceRule
  dataRetentionDays?: number | null
  reminderDefaults?: ReminderDefaults
  onboardingCompletedAt?: string
  sharedDevice?: SharedDeviceSettings
}

export type SharedDeviceSettings = {
  enabled?: boolean
  sessionMinutes?: number
}

export type EvidenceRule = 'none' | 'checklist' | 'photo' | 'supervisor_review'

export type ReminderDefaults = {
  taskReminders: boolean
  taskOverdue: boolean
  dailySummary: boolean
  weeklySummary: boolean
}

export type SpaceModules = {
  tasks?: boolean
  areas?: boolean
  supplies?: boolean
  issues?: boolean
  plants?: boolean
  inventory?: boolean
  maintenance?: boolean
  decluttering?: boolean
  reports?: boolean
  teams?: boolean
  rotation?: boolean
}

export type SpaceType = 'personal' | 'shared_home' | 'workplace' | 'institution' | 'healthcare' | 'custom'

export type SpaceInsert = {
  id?: string
  organization_id: string
  name: string
  type: SpaceType
  timezone: string
  settings?: SpaceSettings
  modules?: SpaceModules
  created_by: string
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

export type SpaceUpdate = {
  name?: string
  type?: SpaceType
  timezone?: string
  settings?: SpaceSettings
  modules?: SpaceModules
  updated_at?: string
  deleted_at?: string | null
}

/* Areas */
export type Area = {
  id: string
  space_id: string
  parent_area_id: string | null
  name: string
  category: string | null
  qr_token: string | null
  qr_token_rotated_at: string | null
  active: boolean
  sort_order: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type AreaInsert = {
  id?: string
  space_id: string
  parent_area_id?: string | null
  name: string
  category?: string | null
  qr_token?: string | null
  active?: boolean
  sort_order?: number
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

export type AreaUpdate = {
  parent_area_id?: string | null
  name?: string
  category?: string | null
  qr_token?: string | null
  qr_token_rotated_at?: string | null
  active?: boolean
  sort_order?: number
  updated_at?: string
  deleted_at?: string | null
}

/* Memberships */
export type Membership = {
  id: string
  user_id: string
  space_id: string
  role: MembershipRole
  team_id: string | null
  joined_at: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type MembershipRole = 'owner' | 'admin' | 'supervisor' | 'member' | 'cleaner' | 'auditor'

export type MembershipInsert = {
  id?: string
  user_id: string
  space_id: string
  role: MembershipRole
  team_id?: string | null
  joined_at?: string
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

export type MembershipUpdate = {
  role?: MembershipRole
  team_id?: string | null
  updated_at?: string
  deleted_at?: string | null
}

/* Task Templates */
export type TaskTemplate = {
  id: string
  space_id: string
  area_id: string | null
  name: string
  description: string | null
  estimated_minutes: number | null
  frequency: TaskFrequency
  custom_frequency_days: number | null
  due_time: string
  default_assignee_role: MembershipRole | null
  required_skills: string[]
  supplies_needed: string[]
  instructions: string | null
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type TaskFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom'

export type TaskTemplateInsert = {
  id?: string
  space_id: string
  area_id?: string | null
  name: string
  description?: string | null
  estimated_minutes?: number | null
  frequency: TaskFrequency
  custom_frequency_days?: number | null
  due_time?: string
  default_assignee_role?: MembershipRole | null
  required_skills?: string[]
  supplies_needed?: string[]
  instructions?: string | null
  is_active?: boolean
  created_by: string
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

export type TaskTemplateUpdate = {
  area_id?: string | null
  name?: string
  description?: string | null
  estimated_minutes?: number | null
  frequency?: TaskFrequency
  custom_frequency_days?: number | null
  due_time?: string
  default_assignee_role?: MembershipRole | null
  required_skills?: string[]
  supplies_needed?: string[]
  instructions?: string | null
  is_active?: boolean
  updated_at?: string
  deleted_at?: string | null
}

/* Tasks */
export type Task = {
  id: string
  space_id: string
  template_id: string | null
  area_id: string | null
  name: string
  description: string | null
  estimated_minutes: number | null
  frequency: TaskFrequency
  custom_frequency_days: number | null
  due_time: string
  schedule_anchor_at: string
  assignee_id: string | null
  assignee_role: MembershipRole | null
  assignee_team_id: string | null
  rotation_enabled: boolean
  rotation_cursor: number
  required_skills: string[]
  supplies_needed: string[]
  instructions: string | null
  evidence_rule: string | null
  is_active: boolean
  is_one_off: boolean
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type TaskInsert = {
  id?: string
  space_id: string
  template_id?: string | null
  area_id?: string | null
  name: string
  description?: string | null
  estimated_minutes?: number | null
  frequency: TaskFrequency
  custom_frequency_days?: number | null
  due_time?: string
  schedule_anchor_at?: string
  assignee_id?: string | null
  assignee_role?: MembershipRole | null
  assignee_team_id?: string | null
  rotation_enabled?: boolean
  rotation_cursor?: number
  required_skills?: string[]
  supplies_needed?: string[]
  instructions?: string | null
  is_active?: boolean
  is_one_off?: boolean
  created_by: string
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

export type TaskUpdate = {
  template_id?: string | null
  area_id?: string | null
  name?: string
  description?: string | null
  estimated_minutes?: number | null
  frequency?: TaskFrequency
  custom_frequency_days?: number | null
  due_time?: string
  schedule_anchor_at?: string
  assignee_id?: string | null
  assignee_role?: MembershipRole | null
  assignee_team_id?: string | null
  rotation_enabled?: boolean
  rotation_cursor?: number
  required_skills?: string[]
  supplies_needed?: string[]
  instructions?: string | null
  is_active?: boolean
  is_one_off?: boolean
  updated_at?: string
  deleted_at?: string | null
}

/* Task Dependencies */
export type TaskDependency = {
  id: string
  space_id: string
  task_id: string
  depends_on_task_id: string
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type TaskDependencyInsert = {
  id?: string
  space_id: string
  task_id: string
  depends_on_task_id: string
  created_by: string
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

export type TaskDependencyUpdate = {
  updated_at?: string
  deleted_at?: string | null
}

/* Task Instances */
export type TaskInstance = {
  id: string
  task_id: string
  space_id: string
  assignee_id: string | null
  due_at: string
  timezone: string
  status: TaskStatus
  started_at: string | null
  completed_at: string | null
  skipped_at: string | null
  skip_reason: string | null
  verification_status: TaskVerificationStatus
  submitted_at: string | null
  verified_by: string | null
  verified_at: string | null
  verification_note: string | null
  rework_requested_by: string | null
  rework_requested_at: string | null
  rework_note: string | null
  rework_of_instance_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type TaskVerificationStatus = 'not_required' | 'pending' | 'verified' | 'rework_requested'

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'overdue'

export type TaskInstanceInsert = {
  id?: string
  task_id: string
  space_id: string
  assignee_id?: string | null
  due_at: string
  timezone: string
  status?: TaskStatus
  started_at?: string | null
  completed_at?: string | null
  skipped_at?: string | null
  skip_reason?: string | null
  verification_status?: TaskVerificationStatus
  submitted_at?: string | null
  verified_by?: string | null
  verified_at?: string | null
  verification_note?: string | null
  rework_requested_by?: string | null
  rework_requested_at?: string | null
  rework_note?: string | null
  rework_of_instance_id?: string | null
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

export type TaskInstanceUpdate = {
  assignee_id?: string | null
  due_at?: string
  timezone?: string
  status?: TaskStatus
  started_at?: string | null
  completed_at?: string | null
  skipped_at?: string | null
  skip_reason?: string | null
  verification_status?: TaskVerificationStatus
  submitted_at?: string | null
  verified_by?: string | null
  verified_at?: string | null
  verification_note?: string | null
  rework_requested_by?: string | null
  rework_requested_at?: string | null
  rework_note?: string | null
  rework_of_instance_id?: string | null
  updated_at?: string
  deleted_at?: string | null
}

/* Task Completions */
export type TaskCompletion = {
  id: string
  task_instance_id: string
  user_id: string
  completed_at: string
  duration_minutes: number | null
  notes: string | null
  photos: string[]
  quality_rating: number | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type TaskCompletionInsert = {
  id?: string
  task_instance_id: string
  user_id: string
  completed_at?: string
  duration_minutes?: number | null
  notes?: string | null
  photos?: string[]
  quality_rating?: number | null
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

export type TaskCompletionUpdate = {
  duration_minutes?: number | null
  notes?: string | null
  photos?: string[]
  quality_rating?: number | null
  updated_at?: string
  deleted_at?: string | null
}

/* Task Checklist Items */
export type TaskChecklistItem = {
  id: string
  space_id: string
  task_id: string
  label: string
  position: number
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type TaskChecklistItemInsert = {
  id?: string
  space_id: string
  task_id: string
  label: string
  position: number
  created_by: string
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

export type TaskChecklistItemUpdate = {
  label?: string
  position?: number
  updated_at?: string
  deleted_at?: string | null
}

/* Task Checklist Results */
export type TaskChecklistResult = {
  id: string
  space_id: string
  task_instance_id: string
  checklist_item_id: string
  label_snapshot: string
  status: ChecklistResultStatus
  note: string | null
  issue_id: string | null
  actor_user_id: string
  created_at: string
  updated_at: string
}

export type ChecklistResultStatus = 'done' | 'not_applicable' | 'problem'

export type TaskChecklistResultInsert = {
  id?: string
  space_id: string
  task_instance_id: string
  checklist_item_id: string
  label_snapshot: string
  status: ChecklistResultStatus
  note?: string | null
  issue_id?: string | null
  actor_user_id: string
  created_at?: string
  updated_at?: string
}

export type TaskChecklistResultUpdate = {
  label_snapshot?: string
  status?: ChecklistResultStatus
  note?: string | null
  issue_id?: string | null
  updated_at?: string
}

/* Shared Device Pins */
export type SharedDevicePin = {
  id: string
  space_id: string
  user_id: string
  pin_hash: string
  failed_attempts: number
  locked_until: string | null
  created_at: string
  updated_at: string
}

export type SharedDevicePinInsert = {
  id?: string
  space_id: string
  user_id: string
  pin_hash: string
  failed_attempts?: number
  locked_until?: string | null
  created_at?: string
  updated_at?: string
}

export type SharedDevicePinUpdate = {
  pin_hash?: string
  failed_attempts?: number
  locked_until?: string | null
  updated_at?: string
}

/* Shared Device Sessions */
export type SharedDeviceSession = {
  id: string
  space_id: string
  user_id: string
  token_hash: string
  created_by: string
  created_at: string
  last_used_at: string | null
  expires_at: string
  revoked_at: string | null
}

export type SharedDeviceSessionInsert = {
  id?: string
  space_id: string
  user_id: string
  token_hash: string
  created_by: string
  created_at?: string
  last_used_at?: string | null
  expires_at: string
  revoked_at?: string | null
}

export type SharedDeviceSessionUpdate = {
  last_used_at?: string | null
  revoked_at?: string | null
}

export type SharedDeviceMember = {
  member_id: string
  full_name: string
  role: MembershipRole
  has_pin: boolean
}

/* Issues */
export type Issue = {
  id: string
  space_id: string
  area_id: string | null
  reported_by: string
  title: string
  description: string | null
  category: IssueCategory
  custom_category: string | null
  priority: IssuePriority
  status: IssueStatus
  assigned_to: string | null
  assigned_team_id: string | null
  external_service: string | null
  assigned_by: string | null
  assigned_at: string | null
  due_at: string | null
  photos: string[]
  estimated_cost: number | null
  actual_cost: number | null
  resolution_note: string | null
  resolved_by: string | null
  resolved_at: string | null
  verified_by: string | null
  verified_at: string | null
  verification_note: string | null
  closed_at: string | null
  reopened_at: string | null
  reopen_count: number
  follow_up_task_id: string | null
  source_task_instance_id: string | null
  source_checklist_item_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type IssuePriority = 'low' | 'medium' | 'high' | 'urgent'
export type IssueStatus =
  | 'reported'
  | 'acknowledged'
  | 'in_progress'
  | 'resolved'
  | 'closed'
  | 'reopened'

export type IssueCategory =
  | 'cleanliness'
  | 'facility'
  | 'supplies'
  | 'organization'
  | 'outdoor'
  | 'other'
  | 'custom'

export type IssueInsert = {
  id?: string
  space_id: string
  area_id?: string | null
  reported_by: string
  title: string
  description?: string | null
  category?: IssueCategory
  custom_category?: string | null
  priority: IssuePriority
  status?: IssueStatus
  assigned_to?: string | null
  assigned_team_id?: string | null
  external_service?: string | null
  assigned_by?: string | null
  assigned_at?: string | null
  due_at?: string | null
  photos?: string[]
  estimated_cost?: number | null
  actual_cost?: number | null
  resolution_note?: string | null
  resolved_by?: string | null
  resolved_at?: string | null
  verified_by?: string | null
  verified_at?: string | null
  verification_note?: string | null
  closed_at?: string | null
  reopened_at?: string | null
  reopen_count?: number
  follow_up_task_id?: string | null
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

export type IssueUpdate = {
  area_id?: string | null
  title?: string
  description?: string | null
  category?: IssueCategory
  custom_category?: string | null
  priority?: IssuePriority
  status?: IssueStatus
  assigned_to?: string | null
  assigned_team_id?: string | null
  external_service?: string | null
  assigned_by?: string | null
  assigned_at?: string | null
  due_at?: string | null
  photos?: string[]
  estimated_cost?: number | null
  actual_cost?: number | null
  resolution_note?: string | null
  resolved_by?: string | null
  resolved_at?: string | null
  verified_by?: string | null
  verified_at?: string | null
  verification_note?: string | null
  closed_at?: string | null
  reopened_at?: string | null
  reopen_count?: number
  follow_up_task_id?: string | null
  updated_at?: string
  deleted_at?: string | null
}

/* Issue Events */
export type IssueEvent = {
  id: string
  issue_id: string
  user_id: string
  action: string
  old_value: Json | null
  new_value: Json | null
  comment: string | null
  created_at: string
}

export type IssueEventInsert = {
  id?: string
  issue_id: string
  user_id: string
  action: string
  old_value?: Json | null
  new_value?: Json | null
  comment?: string | null
  created_at?: string
}

export type IssueEventUpdate = {
  /* Issue events are immutable */
}

/* Issue Patterns */
export type IssuePattern = {
  id: string
  space_id: string
  area_id: string
  category: IssueCategory
  custom_category: string | null
  pattern_key: string
  window_days: number
  window_start: string
  window_end: string
  issue_count: number
  is_recurring: boolean
  last_reported_at: string | null
  refreshed_at: string
  created_at: string
  updated_at: string
}

export type IssuePatternInsert = {
  id?: string
  space_id: string
  area_id: string
  category: IssueCategory
  custom_category?: string | null
  pattern_key: string
  window_days?: number
  window_start: string
  window_end: string
  issue_count?: number
  is_recurring?: boolean
  last_reported_at?: string | null
  refreshed_at?: string
  created_at?: string
  updated_at?: string
}

export type IssuePatternUpdate = {
  category?: IssueCategory
  custom_category?: string | null
  window_start?: string
  window_end?: string
  issue_count?: number
  is_recurring?: boolean
  last_reported_at?: string | null
  refreshed_at?: string
  updated_at?: string
}

/* Supply Items */
export type SupplyItem = {
  id: string
  space_id: string
  area_id: string | null
  name: string
  description: string | null
  category: string | null
  unit: string
  quantity: number
  min_quantity: number
  max_quantity: number | null
  cost_per_unit: number | null
  supplier: string | null
  barcode: string | null
  location: string | null
  expires_at: string | null
  status: SupplyStatus
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type SupplyStatus = 'available' | 'low' | 'out_of_stock' | 'ordered'

export type SupplyItemInsert = {
  id?: string
  space_id: string
  area_id?: string | null
  name: string
  description?: string | null
  category?: string | null
  unit: string
  quantity?: number
  min_quantity?: number
  max_quantity?: number | null
  cost_per_unit?: number | null
  supplier?: string | null
  barcode?: string | null
  location?: string | null
  expires_at?: string | null
  status?: SupplyStatus
  created_by: string
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

export type SupplyItemUpdate = {
  area_id?: string | null
  name?: string
  description?: string | null
  category?: string | null
  unit?: string
  quantity?: number
  min_quantity?: number
  max_quantity?: number | null
  cost_per_unit?: number | null
  supplier?: string | null
  barcode?: string | null
  location?: string | null
  expires_at?: string | null
  status?: SupplyStatus
  updated_at?: string
  deleted_at?: string | null
}

/* Supply Requests */
export type SupplyRequest = {
  id: string
  space_id: string
  supply_item_id: string | null
  requested_by: string
  item_name: string
  quantity: number
  unit: string
  urgency: IssuePriority
  notes: string | null
  status: RequestStatus
  approved_by: string | null
  approved_at: string | null
  fulfilled_by: string | null
  fulfilled_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'fulfilled'

export type SupplyRequestInsert = {
  id?: string
  space_id: string
  supply_item_id?: string | null
  requested_by: string
  item_name: string
  quantity: number
  unit: string
  urgency: IssuePriority
  notes?: string | null
  status?: RequestStatus
  approved_by?: string | null
  approved_at?: string | null
  fulfilled_by?: string | null
  fulfilled_at?: string | null
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

export type SupplyRequestUpdate = {
  supply_item_id?: string | null
  item_name?: string
  quantity?: number
  unit?: string
  urgency?: IssuePriority
  notes?: string | null
  status?: RequestStatus
  approved_by?: string | null
  approved_at?: string | null
  fulfilled_by?: string | null
  fulfilled_at?: string | null
  updated_at?: string
  deleted_at?: string | null
}

/* Notification Preferences */
export type NotificationPreference = {
  id: string
  user_id: string
  space_id: string | null
  email_enabled: boolean
  push_enabled: boolean
  in_app_enabled: boolean
  task_reminders: boolean
  task_overdue: boolean
  task_completed: boolean
  issue_reported: boolean
  issue_assigned: boolean
  issue_resolved: boolean
  supply_low: boolean
  supply_requested: boolean
  supply_fulfilled: boolean
  recommendation_new: boolean
  mention: boolean
  daily_summary: boolean
  weekly_summary: boolean
  quiet_hours_start: string | null
  quiet_hours_end: string | null
  timezone: string
  created_at: string
  updated_at: string
}

export type NotificationPreferenceInsert = {
  id?: string
  user_id: string
  space_id?: string | null
  email_enabled?: boolean
  push_enabled?: boolean
  in_app_enabled?: boolean
  task_reminders?: boolean
  task_overdue?: boolean
  task_completed?: boolean
  issue_reported?: boolean
  issue_assigned?: boolean
  issue_resolved?: boolean
  supply_low?: boolean
  supply_requested?: boolean
  supply_fulfilled?: boolean
  recommendation_new?: boolean
  mention?: boolean
  daily_summary?: boolean
  weekly_summary?: boolean
  quiet_hours_start?: string | null
  quiet_hours_end?: string | null
  timezone?: string
  created_at?: string
  updated_at?: string
}

export type NotificationPreferenceUpdate = {
  email_enabled?: boolean
  push_enabled?: boolean
  in_app_enabled?: boolean
  task_reminders?: boolean
  task_overdue?: boolean
  task_completed?: boolean
  issue_reported?: boolean
  issue_assigned?: boolean
  issue_resolved?: boolean
  supply_low?: boolean
  supply_requested?: boolean
  supply_fulfilled?: boolean
  recommendation_new?: boolean
  mention?: boolean
  daily_summary?: boolean
  weekly_summary?: boolean
  quiet_hours_start?: string | null
  quiet_hours_end?: string | null
  timezone?: string
  updated_at?: string
}

export type NotificationType =
  | 'task_reminder'
  | 'task_overdue'
  | 'task_completed'
  | 'issue_reported'
  | 'issue_assigned'
  | 'issue_resolved'
  | 'supply_low'
  | 'supply_requested'
  | 'supply_fulfilled'
  | 'recommendation_new'
  | 'mention'
  | 'daily_summary'
  | 'weekly_summary'

export type Notification = {
  id: string
  space_id: string
  user_id: string
  type: NotificationType
  title: string
  body: string
  metadata: Json
  read_at: string | null
  created_at: string
}

export type NotificationInsert = {
  id?: string
  space_id: string
  user_id: string
  type: NotificationType
  title: string
  body?: string
  metadata?: Json
  read_at?: string | null
  created_at?: string
}

export type NotificationUpdate = {
  read_at?: string | null
}

/* Recommendations */
export type Recommendation = {
  id: string
  space_id: string
  type: RecommendationType
  title: string
  reason: string
  data: Json
  action: RecommendationAction
  action_data: Json | null
  status: 'pending' | 'accepted' | 'edited' | 'dismissed' | 'disabled'
  created_by: string | null
  created_at: string
  updated_at: string
  dismissed_at: string | null
  dismissed_by: string | null
}

export type RecommendationType = 'rebalance' | 'schedule' | 'supply' | 'maintenance' | 'other'
export type RecommendationAction = 'accept' | 'edit' | 'dismiss' | 'disable'

export type RecommendationInsert = {
  id?: string
  space_id: string
  type: RecommendationType
  title: string
  reason: string
  data: Json
  action: RecommendationAction
  action_data?: Json | null
  status?: 'pending' | 'accepted' | 'edited' | 'dismissed' | 'disabled'
  created_by?: string | null
  created_at?: string
  updated_at?: string
  dismissed_at?: string | null
  dismissed_by?: string | null
}

export type RecommendationUpdate = {
  type?: RecommendationType
  title?: string
  reason?: string
  data?: Json
  action?: RecommendationAction
  action_data?: Json | null
  status?: 'pending' | 'accepted' | 'edited' | 'dismissed' | 'disabled'
  dismissed_at?: string | null
  dismissed_by?: string | null
  updated_at?: string
}

/* Audit Events */
export type AuditEvent = {
  id: string
  space_id: string | null
  user_id: string | null
  action: string
  resource_type: string
  resource_id: string | null
  old_value: Json | null
  new_value: Json | null
  metadata: Json
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export type AuditEventInsert = {
  id?: string
  space_id?: string | null
  user_id?: string | null
  action: string
  resource_type: string
  resource_id?: string | null
  old_value?: Json | null
  new_value?: Json | null
  metadata?: Json
  ip_address?: string | null
  user_agent?: string | null
  created_at?: string
}

export type AuditEventUpdate = {
  /* Audit events are immutable */
}

/* Teams */
export type Team = {
  id: string
  space_id: string
  name: string
  description: string | null
  color: string | null
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type TeamInsert = {
  id?: string
  space_id: string
  name: string
  description?: string | null
  color?: string | null
  created_by: string
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

export type TeamUpdate = {
  name?: string
  description?: string | null
  color?: string | null
  updated_at?: string
  deleted_at?: string | null
}

/* Team Members */
export type TeamMember = {
  id: string
  team_id: string
  user_id: string
  role: 'lead' | 'member'
  joined_at: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type TeamMemberInsert = {
  id?: string
  team_id: string
  user_id: string
  role?: 'lead' | 'member'
  joined_at?: string
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

export type TeamMemberUpdate = {
  role?: 'lead' | 'member'
  updated_at?: string
  deleted_at?: string | null
}

/* Task Assignments */
export type TaskAssignment = {
  id: string
  task_id: string
  space_id: string
  user_id: string
  assigned_by: string
  assigned_at: string
  rotation_index: number | null
  is_active: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type TaskAssignmentInsert = {
  id?: string
  task_id: string
  space_id?: string
  user_id: string
  assigned_by: string
  assigned_at?: string
  rotation_index?: number | null
  is_active?: boolean
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

export type TaskAssignmentUpdate = {
  user_id?: string
  rotation_index?: number | null
  is_active?: boolean
  updated_at?: string
  deleted_at?: string | null
}

/* Task Comments */
export type TaskComment = {
  id: string
  task_instance_id: string
  user_id: string
  content: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type TaskCommentInsert = {
  id?: string
  task_instance_id: string
  user_id: string
  content: string
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

export type TaskCommentUpdate = {
  content?: string
  updated_at?: string
  deleted_at?: string | null
}

/* Task Swaps */
export type TaskSwap = {
  id: string
  task_instance_id: string
  requested_by: string
  requested_to: string | null
  reason: string | null
  status: SwapStatus
  responded_by: string | null
  responded_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type SwapStatus = 'pending' | 'accepted' | 'declined' | 'cancelled'

export type TaskSwapInsert = {
  id?: string
  task_instance_id: string
  requested_by: string
  requested_to?: string | null
  reason?: string | null
  status?: SwapStatus
  responded_by?: string | null
  responded_at?: string | null
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

export type TaskSwapUpdate = {
  requested_to?: string | null
  reason?: string | null
  status?: SwapStatus
  responded_by?: string | null
  responded_at?: string | null
  updated_at?: string
  deleted_at?: string | null
}

/* Member Away */
export type MemberAway = {
  id: string
  space_id: string
  user_id: string
  type: AwayType
  reason: string | null
  starts_at: string
  ends_at: string | null
  created_by: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type AwayType = 'illness' | 'travel' | 'personal' | 'other'

export type MemberAwayInsert = {
  id?: string
  space_id: string
  user_id: string
  type: AwayType
  reason?: string | null
  starts_at: string
  ends_at?: string | null
  created_by: string
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

export type MemberAwayUpdate = {
  type?: AwayType
  reason?: string | null
  starts_at?: string
  ends_at?: string | null
  updated_at?: string
  deleted_at?: string | null
}

/* Invitations */
export type Invitation = {
  id: string
  space_id: string
  email: string | null
  role: MembershipRole
  token: string
  invited_by: string
  status: InvitationStatus
  expires_at: string
  accepted_at: string | null
  accepted_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired'

export type InvitationInsert = {
  id?: string
  space_id: string
  email?: string | null
  role: MembershipRole
  token?: string
  invited_by: string
  status?: InvitationStatus
  expires_at: string
  accepted_at?: string | null
  accepted_by?: string | null
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

export type InvitationUpdate = {
  email?: string | null
  role?: MembershipRole
  status?: InvitationStatus
  expires_at?: string
  accepted_at?: string | null
  accepted_by?: string | null
  updated_at?: string
  deleted_at?: string | null
}

/* Helper Types for RPCs */
export type QrAreaLookup = {
  area_id: string
  area_name: string
  area_active: boolean
  space_id: string
  space_name: string
  space_type: SpaceType
  timezone: string
  qr_enabled: boolean
  shared_device_enabled: boolean
  shared_device_session_minutes: number
}