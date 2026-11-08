import React from 'react';
import PinEntrySheet from './utilities/PinEntrySheet';

const PinUpdate = ({ visible, onClose }) => (
  <PinEntrySheet
    visible={visible}
    onClose={onClose}
    action="changePin"
    requiresOldPin
    title="Set your new PIN"
    successMessage="Your transaction PIN was updated successfully."
  />
);

export default PinUpdate;