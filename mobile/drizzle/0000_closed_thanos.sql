CREATE TABLE `expenses` (
	`client_id` text PRIMARY KEY NOT NULL,
	`description` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'USD',
	`category` text,
	`labels` text,
	`occurred_at` integer NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`synced_at` integer
);
--> statement-breakpoint
CREATE TABLE `todos` (
	`client_id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`due_at` integer,
	`done` integer DEFAULT 0 NOT NULL,
	`category` text,
	`labels` text,
	`estimated_minutes` integer,
	`notification_id` text,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`synced_at` integer
);
