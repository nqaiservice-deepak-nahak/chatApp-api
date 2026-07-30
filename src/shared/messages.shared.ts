const messageFactory = (message: messages, msgParams?: string[]): string => {
  let newMsg: string = message as unknown as string;
  if (msgParams && msgParams.length > 0) {
    msgParams.forEach((val, key) => {
      newMsg = newMsg.split(`ARG${key}`).join(val?.toString());
    });
  }
  return newMsg;
};

const enum messages {
  /*Success messages : Start with Sn*/
  S1 = 'Real-Time Group Chat API is listening on ARG0.',
  S2 = 'Connected to MongoDB server!',
  S3 = 'Success.',
  S4 = 'User registered successfully.',
  S5 = 'Login successful.',
  S6 = 'Group created successfully.',
  S7 = 'Joined group successfully.',
  S8 = 'Groups fetched successfully.',
  S9 = 'Group details fetched successfully.',
  S10 = 'Messages fetched successfully.',
  S11 = 'Message sent successfully.',
  S12 = 'Group deleted successfully.',

  /*Warning messages : Start with Wn*/
  W1 = 'Please provide a valid ARG0!',
  W2 = 'ARG0 should not be empty!',
  W3 = 'ARG0 should be a numeric value!',
  W4 = 'ARG0 should not exceed more than ARG1 characters.',
  W5 = 'ARG0 not found.',
  W6 = 'This email is already registered. Please log in instead.',
  W7 = 'Invalid email or password.',
  W8 = 'You have already joined this group.',
  W9 = 'You are not a member of this group.',
  W10 = 'Invalid or expired token.',
  W11 = 'Invalid group id.',
  W12 = 'Authorization token is required.',
  W13 = 'Only the group creator can delete this group.',

  /*Error messages : Start with En*/
  E1 = 'Application failed to start: ARG0',
  E2 = 'Something went wrong. Please try again later.',
  E3 = 'Unauthorized access.',
  E4 = 'MongoDB connection error: ARG0',
  E5 = 'MongoDB disconnected.'
}

export { messageFactory, messages };
