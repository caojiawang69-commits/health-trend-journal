CREATE TABLE `health` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`kind` text NOT NULL,
	`payload` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `meals` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`occurred` text NOT NULL,
	`timezone` text NOT NULL,
	`note` text NOT NULL,
	`before_key` text,
	`after_key` text,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`date` text PRIMARY KEY NOT NULL,
	`body` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
