/** Result of a form server action used with useActionState. */
export interface ActionState {
  error: string | null;
  savedAt: number | null;
}

export const INITIAL_ACTION_STATE: ActionState = { error: null, savedAt: null };

export type FormAction = (previous: ActionState, formData: FormData) => Promise<ActionState>;
