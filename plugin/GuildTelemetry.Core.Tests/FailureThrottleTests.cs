using GuildTelemetry.Core;
using Xunit;

namespace GuildTelemetry.Core.Tests
{
    public sealed class FailureThrottleTests
    {
        [Fact]
        public void ReportsTheFirstFailureAndHoldsBackRepeatsInsideTheWindow()
        {
            FailureThrottle throttle = new FailureThrottle(60);
            int suppressed;
            Assert.True(throttle.Admit("RPC_RoutedRPC", 100, out suppressed));
            Assert.Equal(0, suppressed);
            Assert.False(throttle.Admit("RPC_RoutedRPC", 100.5, out suppressed));
            Assert.False(throttle.Admit("RPC_RoutedRPC", 159.9, out suppressed));
            Assert.Equal(0, suppressed);
        }

        [Fact]
        public void ReportsAgainAfterTheWindowWithTheCountHeldBack()
        {
            FailureThrottle throttle = new FailureThrottle(60);
            int suppressed;
            throttle.Admit("RPC_RoutedRPC", 100, out suppressed);
            throttle.Admit("RPC_RoutedRPC", 101, out suppressed);
            throttle.Admit("RPC_RoutedRPC", 102, out suppressed);
            throttle.Admit("RPC_RoutedRPC", 103, out suppressed);
            Assert.True(throttle.Admit("RPC_RoutedRPC", 160, out suppressed));
            Assert.Equal(3, suppressed);
            Assert.False(throttle.Admit("RPC_RoutedRPC", 161, out suppressed));
            Assert.True(throttle.Admit("RPC_RoutedRPC", 220, out suppressed));
            Assert.Equal(1, suppressed);
        }

        [Fact]
        public void KeepsEachHookApart()
        {
            FailureThrottle throttle = new FailureThrottle(60);
            int suppressed;
            Assert.True(throttle.Admit("RPC_RoutedRPC", 100, out suppressed));
            Assert.True(throttle.Admit("ZDO.Deserialize", 100, out suppressed));
            Assert.False(throttle.Admit("RPC_RoutedRPC", 110, out suppressed));
            Assert.True(throttle.Admit("ZDO.Deserialize", 160, out suppressed));
            Assert.Equal(0, suppressed);
        }
    }
}
