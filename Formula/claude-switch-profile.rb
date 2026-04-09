require "language/node"

class ClaudeSwitchProfile < Formula
  desc "CLI tool for managing multiple Claude Code profiles"
  homepage "https://github.com/ThanhThi2895/claude-switch-profile"
  url "https://registry.npmjs.org/claude-switch-profile/-/claude-switch-profile-1.4.21.tgz"
  sha256 "a76a2c269e592ec1e2c759c8afcbbdd2d4b8955a300a2bb16aea90d48afa74a5"
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
