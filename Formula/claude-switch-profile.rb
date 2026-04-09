require "language/node"

class ClaudeSwitchProfile < Formula
  desc "CLI tool for managing multiple Claude Code profiles"
  homepage "https://github.com/ThanhThi2895/claude-switch-profile"
  url "https://registry.npmjs.org/claude-switch-profile/-/claude-switch-profile-1.4.22.tgz"
  sha256 "4d828740a0d3c6e77093ca074686ab71412589c6eaa987a0d2e92002294e1a95"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *Language::Node.std_npm_install_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    assert_match "Usage: csp", shell_output("#{bin}/csp --help")
  end
end
