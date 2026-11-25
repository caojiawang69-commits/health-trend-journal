export const periods=['week','month','year'] as const;
export type Period=typeof periods[number];
export type PeriodReview={period:Period;end:string;from:string;body:string;created:string};
