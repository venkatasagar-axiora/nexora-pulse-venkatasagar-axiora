import API from "./axios";

// UPDATE NAME
export const updateProfile = (full_name) => {
  return API.put("/profile/update", null, {
    params: { full_name }
  });
};

// CHANGE PASSWORD
export const changePassword = (current_password, new_password) => {
  return API.put("/profile/change-password", null, {
    params: { current_password, new_password }
  });
};