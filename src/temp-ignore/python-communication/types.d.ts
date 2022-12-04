
type SetupCode = {
    /**
     * Code that is run once, to set up the environment
     */
    setupCode: string;
    /**
     * Code that is run before the setup code, to avoid re-running the setup code
     */
    testSetupCode: string;
}