#[derive(PartialEq, Clone, Copy, Debug)]
pub(crate) enum ToggleState {
    On,
    Off,
}

impl From<bool> for ToggleState {
    fn from(b: bool) -> Self {
        if b {
            ToggleState::On
        } else {
            ToggleState::Off
        }
    }
}

impl From<ToggleState> for bool {
    fn from(t: ToggleState) -> Self {
        match t {
            ToggleState::On => true,
            ToggleState::Off => false,
        }
    }
}
