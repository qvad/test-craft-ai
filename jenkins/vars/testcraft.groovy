/**
 * TestCraft Jenkins Shared Library
 *
 * Usage in Jenkinsfile:
 * @Library('testcraft') _
 *
 * testcraft.run(
 *   plan: 'tests/api-tests.hocon',
 *   environment: 'staging',
 *   parallel: true
 * )
 */

def call(Map config = [:]) {
    run(config)
}

/**
 * Run a TestCraft test plan
 *
 * @param config Map with the following options:
 *   - plan: Path to the HOCON test plan file (required)
 *   - apiUrl: TestCraft API URL (default: from TESTCRAFT_API_URL env var)
 *   - environment: Target environment (default: 'staging')
 *   - parallel: Run tests in parallel (default: true)
 *   - variables: Map of variables to pass to the test plan
 *   - formats: List of report formats (default: ['json', 'html', 'junit'])
 *   - outputDir: Report output directory (default: 'test-reports')
 *   - dryRun: Validate without executing (default: false)
 *   - verbose: Enable verbose output (default: false)
 *   - ci: CI mode - exit with error on failure (default: true)
 *   - strict: Strict validation mode (default: false)
 */
def run(Map config = [:]) {
    def plan = config.plan ?: error('Test plan path is required')
    def apiUrl = config.apiUrl ?: env.TESTCRAFT_API_URL
    def environment = config.environment ?: 'staging'
    def parallel = config.parallel != false
    def variables = config.variables ?: [:]
    def formats = config.formats ?: ['json', 'html', 'junit']
    def outputDir = config.outputDir ?: 'test-reports'
    def dryRun = config.dryRun ?: false
    def verbose = config.verbose ?: false
    def ci = config.ci != false
    def strict = config.strict ?: false

    if (!apiUrl) {
        error('TestCraft API URL is required. Set TESTCRAFT_API_URL or pass apiUrl parameter.')
    }

    // Build command
    def cmd = buildRunCommand(
        plan: plan,
        apiUrl: apiUrl,
        environment: environment,
        parallel: parallel,
        variables: variables,
        formats: formats,
        outputDir: outputDir,
        dryRun: dryRun,
        verbose: verbose,
        ci: ci
    )

    // Execute
    sh cmd

    // Archive and publish results
    if (!dryRun) {
        archiveArtifacts artifacts: "${outputDir}/**/*", allowEmptyArchive: true

        if (formats.contains('junit')) {
            junit testResults: "${outputDir}/test-report.xml", allowEmptyResults: true
        }

        if (formats.contains('html')) {
            publishHTML(target: [
                allowMissing: true,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: outputDir,
                reportFiles: 'test-report.html',
                reportName: 'TestCraft Report'
            ])
        }
    }
}

/**
 * Validate a TestCraft test plan
 */
def validate(Map config = [:]) {
    def plan = config.plan ?: error('Test plan path is required')
    def strict = config.strict ?: false

    def cmd = "testcraft validate ${plan}"
    if (strict) {
        cmd += ' --strict'
    }

    sh cmd
}

/**
 * Import a test plan to the TestCraft server
 */
def importPlan(Map config = [:]) {
    def plan = config.plan ?: error('Test plan path is required')
    def apiUrl = config.apiUrl ?: env.TESTCRAFT_API_URL
    def name = config.name ?: ''

    if (!apiUrl) {
        error('TestCraft API URL is required')
    }

    def cmd = "testcraft import ${plan} --api-url ${apiUrl}"
    if (name) {
        cmd += " --name '${name}'"
    }

    sh cmd
}

/**
 * Export a test plan from the TestCraft server
 */
def exportPlan(Map config = [:]) {
    def id = config.id ?: error('Plan ID is required')
    def file = config.file ?: error('Output file path is required')
    def apiUrl = config.apiUrl ?: env.TESTCRAFT_API_URL

    if (!apiUrl) {
        error('TestCraft API URL is required')
    }

    sh "testcraft export ${id} ${file} --api-url ${apiUrl}"
}

/**
 * List test plans on the server
 */
def list(Map config = [:]) {
    def apiUrl = config.apiUrl ?: env.TESTCRAFT_API_URL
    def tags = config.tags ?: []
    def search = config.search ?: ''
    def json = config.json ?: false

    if (!apiUrl) {
        error('TestCraft API URL is required')
    }

    def cmd = "testcraft list --api-url ${apiUrl}"

    if (tags) {
        cmd += " --tags ${tags.join(',')}"
    }
    if (search) {
        cmd += " --search '${search}'"
    }
    if (json) {
        cmd += ' --json'
    }

    return sh(script: cmd, returnStdout: json)
}

/**
 * Initialize a new test plan from template
 */
def init(Map config = [:]) {
    def name = config.name ?: 'test-plan'
    def dir = config.dir ?: '.'

    sh "testcraft init --name ${name} --output ${dir}/${name}.hocon"
}

/**
 * Run multiple test plans in parallel
 */
def runParallel(List plans, Map commonConfig = [:]) {
    def parallelStages = [:]

    plans.each { planConfig ->
        def config = commonConfig + planConfig
        def planName = planConfig.name ?: planConfig.plan

        parallelStages[planName] = {
            stage(planName) {
                run(config)
            }
        }
    }

    parallel parallelStages
}

/**
 * Build the testcraft run command
 */
private def buildRunCommand(Map config) {
    def cmd = "testcraft run ${config.plan}"
    cmd += " --api-url ${config.apiUrl}"
    cmd += " --environment ${config.environment}"
    cmd += " --output ${config.outputDir}"

    config.formats.each { format ->
        cmd += " --format ${format}"
    }

    if (config.parallel) {
        cmd += ' --parallel'
    }

    config.variables.each { key, value ->
        cmd += " --var ${key}=${value}"
    }

    if (config.dryRun) {
        cmd += ' --dry-run'
    }

    if (config.verbose) {
        cmd += ' --verbose'
    }

    if (config.ci) {
        cmd += ' --ci'
    }

    return cmd
}
