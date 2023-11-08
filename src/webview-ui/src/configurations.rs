use std::rc::Rc;

use yew::prelude::*;

#[derive(Debug, PartialEq, Eq, Clone)]
pub struct RenderingConfiguration {
    pub minimum_size_to_render_pixel_border: usize,
    pub minimum_size_to_render_pixel_values: usize,
}
impl Default for RenderingConfiguration {
    fn default() -> RenderingConfiguration {
        Self {
            minimum_size_to_render_pixel_border: 30,
            minimum_size_to_render_pixel_values: 50,
        }
    }
}

#[derive(Debug, PartialEq, Eq, Clone, Default)]
pub struct Configuration {
    pub rendering: RenderingConfiguration,
}

pub enum UpdateConfigurationAction {}

impl UpdateConfigurationAction {
    fn update(self, configuration: Configuration) -> Configuration {
        match self {
            
        }
    }
}

impl Reducible for Configuration {
    type Action = UpdateConfigurationAction;

    fn reduce(self: Rc<Self>, action: Self::Action) -> Rc<Self> {
        Rc::new(action.update((*self).clone()))
    }
}

pub type ConfigurationContext = UseReducerHandle<Configuration>;

#[derive(Properties, Debug, PartialEq)]
pub struct ConfigurationProviderProps {
    #[prop_or_default]
    pub children: Html,
}

#[function_component]
pub fn ConfigurationProvider(props: &ConfigurationProviderProps) -> Html {
    let msg = use_reducer(|| Configuration::default());

    html! {
        <ContextProvider<ConfigurationContext> context={msg}>
            {props.children.clone()}
        </ContextProvider<ConfigurationContext>>
    }
}
